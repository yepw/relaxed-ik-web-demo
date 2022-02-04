import { fetchFromURL } from "../helpers.js";

function createBlob(text) {
    var blob = new Blob([text], {
        type: 'text/plain'
    });
    return blob;
}

// func acts on a blob
export function getURDFFromLocal(files, func) {
    let fileArray = Array.from(files);
    let urdfFile = fileArray.find(file => file.webkitRelativePath.includes("/urdf/"));
    let daeFiles = fileArray.filter(file => file.webkitRelativePath.includes(".dae"));
    let stlFiles = fileArray.filter(file => file.webkitRelativePath.includes(".stl"));
    let dataFiles = daeFiles.concat(stlFiles)

    getMeshFiles(dataFiles, fileArray, (map) => {
        let urdfStr;
        let modifiedBlob;
        let fr = new FileReader();
        fr.onload = function () {
            urdfStr = fr.result;
            fileArray.forEach(file => {
                let path = file.webkitRelativePath;
                let tag = "";
                if (/\.stl$/i.test(path)) {
                    tag = ".stlX"
                } else if (/\.dae$/i.test(path)) {
                    tag = ".daeX"
                }
                let replaceLink = "package://" + path;
                let newLink = map.get(replaceLink)
                urdfStr = urdfStr.replaceAll(replaceLink, newLink);
            })
            modifiedBlob = createBlob(urdfStr);
            func(modifiedBlob);
        }
        fr.readAsText(urdfFile);
    })
}

// func acts on a blob
export function getURDFFromURL(link, func) {
    let imageMap = new Map()
    let extractFileLinks = (urdfBlob) => {
        let fetchCount = 0;
        let fr = new FileReader();
        fr.onload = function () {
            let urdfStr = fr.result;
            let parser = new DOMParser();
            let xml = parser.parseFromString(urdfStr, "text/xml");
            let meshes = Array.from(xml.getElementsByTagName("mesh"));
            if (meshes.length == 0) {
                let modifiedBlob = createBlob(urdfStr);
                func(modifiedBlob);
            }
            else {
                meshes.forEach(mesh => {
                    let filePath = mesh.attributes.filename.nodeValue;
                    let urdfFolder = link.substring(0, link.lastIndexOf("/"));
                    let meshURL = mesh.attributes.filename.nodeValue.replace("package://",
                        urdfFolder + "/../../").replaceAll("#", "%23");
                    fetchFromURL(meshURL, (blob) => {
                        let tag = "";
                        if (/\.stl$/i.test(filePath)) {
                            tag = ".stlX"
                            let blobURL = URL.createObjectURL(blob);
                            let newLink = blobURL.substring(blobURL.lastIndexOf("/") + 1).trim() + tag;
                            let replaceLink = filePath;
                            urdfStr = urdfStr.replace(replaceLink, newLink);
                            fetchCount++;
                            if (fetchCount == meshes.length) {
                                let modifiedBlob = createBlob(urdfStr);
                                func(modifiedBlob);
                            }
                        } else if (/\.dae$/i.test(filePath)) {
                            tag = ".daeX"
                            getDAESFromURL(blob, imageMap, meshURL, (newMeshBlob) => {
                                let blobURL = URL.createObjectURL(newMeshBlob);
                                let newLink = blobURL.substring(blobURL.lastIndexOf("/") + 1).trim() + tag;
                                let replaceLink = filePath;
                                urdfStr = urdfStr.replace(replaceLink, newLink);
                                fetchCount++;
                                if (fetchCount == meshes.length) {
                                    let modifiedBlob = createBlob(urdfStr);
                                    func(modifiedBlob);
                                }
                            })
                        }
                    });
                })
            }
        }
        fr.readAsText(urdfBlob);
    }

    fetchFromURL(link, extractFileLinks);
}

function getDAESFromURL(meshBlob, imageMap, meshURL, func) {
    let fr = new FileReader();
    fr.onload = function () {
        let meshStr = fr.result;
        let parser = new DOMParser();
        let xml = parser.parseFromString(meshStr, "text/xml");
        let images = Array.from(xml.getElementsByTagName("image"));
        let newImages = [];
        images.forEach(image => {
            let imageFile = image.childNodes[1].innerHTML
            let imageURL = meshURL.substring(0, meshURL.lastIndexOf("/") + 1) + imageFile;
            if(!imageMap.get(imageURL)) {
                imageMap.set(imageURL, {
                    imageFile: imageFile
                })
                newImages.push(imageURL)
            } else {
                if(imageMap.get(imageURL).newLink) {
                    meshStr = meshStr.replace(imageMap.get(imageURL).imageFile, imageMap.get(imageURL).newLink);
                } else {
                    newImages.push(imageURL)
                }
            }
        })
        if(newImages.length == 0) {
            let modifiedBlob = createBlob(meshStr);
            func(modifiedBlob);
        }
        else {
            let imageCount = 0;
            newImages.forEach(imageURL => {
                fetchFromURL(imageURL, (blob) => {
                    let blobURL = URL.createObjectURL(blob);
                    let newLink = blobURL.substring(blobURL.lastIndexOf("/") + 1).trim();
                    meshStr = meshStr.replace(imageMap.get(imageURL).imageFile, newLink);
                    imageMap.get(imageURL).newLink = newLink;
                    imageCount++;
                    if (imageCount == newImages.length) {
                        let modifiedBlob = createBlob(meshStr);
                        func(modifiedBlob);
                    }
                });
            })
        }
    }
    fr.readAsText(meshBlob);
}

export function loadJsonURL(link, func) {
    fetchFromURL(link, (blob) => {
        let fr = new FileReader();
        fr.onload = function () {
            let jsonStr = fr.result;
            func(jsonStr);
        }
        fr.readAsText(blob);
    })
}

export function loadJsonFile(file, func) {
    let fr = new FileReader();
    fr.onload = function () {
        let jsonStr = fr.result;
        func(jsonStr);
    }
    fr.readAsText(file);
}

function getMeshFiles(meshFiles, fileArray, func) {
    let meshMap = new Map();
    let recursiveDAEModify = (meshFiles, fileArray, index) => {
        let meshFile = meshFiles[index]
        console.log(meshFile)
        let fr = new FileReader();
        fr.onload = function () {
            let daeStr = fr.result;
            fileArray.forEach(file => {
                let path = file.webkitRelativePath;
                let fileURL = URL.createObjectURL(file);
                let newLink = fileURL.substring(fileURL.lastIndexOf("/") + 1).trim()// + tag;
                let replaceLink = path.substring(path.lastIndexOf("/") + 1).trim();
                daeStr = daeStr.replaceAll(replaceLink, newLink);
            })
            let blob = createBlob(daeStr);
            let meshURL = URL.createObjectURL(blob)
            let oldLink = "package://" + meshFile.webkitRelativePath;
            let newLink = meshURL.substring(meshURL.lastIndexOf("/") + 1).trim() + ".daeX";
            meshMap.set(oldLink, newLink)
            recursiveDAEModify(meshFiles, fileArray, index, func)
        }
        if(meshFile) {
            index++;
            if(meshFile.name.includes(".dae")) {
                fr.readAsText(meshFile);
            }
            else if(meshFile.name.includes(".stl")) {
                let meshURL = URL.createObjectURL(meshFile)
                let oldLink = "package://" + meshFile.webkitRelativePath;
                let newLink = meshURL.substring(meshURL.lastIndexOf("/") + 1).trim() + ".stlX";
                meshMap.set(oldLink, newLink)
                recursiveDAEModify(meshFiles, fileArray, index, func)
            } else {
                console.log("unknown file type: ", meshFile.name)
            }
        } else {
            func(meshMap);
        }
    }

    recursiveDAEModify(meshFiles, fileArray, 0)
}