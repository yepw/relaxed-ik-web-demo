import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

export function getSceneColor() {
    return new T.Color(0x263238);
}

export function initScene() {

    let scene, camera, renderer, controls;

    // scene
    scene = new T.Scene();
    scene.background = getSceneColor();

    camera = new T.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.001, 1000);
    camera.position.set(3, 3, 3);
    camera.lookAt(0, 0, 0);

    renderer = new T.WebGLRenderer({ antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    renderer.xr.enabled = true;
    document.body.appendChild( VRButton.createButton( renderer ) );

    const directionalLight = new T.DirectionalLight(0xffffff, 1.0);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.setScalar(1024);
    directionalLight.position.set(5, 30, 5);
    scene.add(directionalLight);

    const ambientLight = new T.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const ground = new T.Mesh(new T.PlaneBufferGeometry(), new T.ShadowMaterial({ opacity: 0.25 }));
    ground.rotation.x = -Math.PI / 2;
    ground.scale.setScalar(30);
    ground.receiveShadow = true;
    scene.add(ground);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.y = 1;
    controls.update();

    let inputs = document.createElement('div');
    inputs.id = "inputs";
    document.body.appendChild(inputs);

    let jointDiv = document.createElement('div');
    jointDiv.id = "joints";
    document.body.appendChild(jointDiv);

    let topDiv = document.createElement('div');
    topDiv.id = "topDiv";
    document.body.appendChild(topDiv); 

    let bottomDiv = document.createElement('div');
    bottomDiv.id = "bottomDiv";
    document.body.appendChild(bottomDiv); 

    // let lineDiv = document.createElement('div');
    // lineDiv.id = "lineDiv";
    // document.body.appendChild(lineDiv); 

    function onResize() {
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    }

    onResize();
    window.addEventListener('resize', onResize);

    return [scene, camera, renderer, controls];
}