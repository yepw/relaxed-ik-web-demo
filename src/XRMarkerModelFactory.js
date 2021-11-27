import * as T from 'three';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const MARKER_MODEL_PATH = '../models/marker/scene.gltf';

class XRMarkerModel extends T.Object3D {

	constructor() {

		super();

		this.marker = null;
		this.envMap = null;

	}

	setEnvironmentMap( envMap ) {

		if ( this.envMap == envMap ) {

			return this;

		}

		this.envMap = envMap;
		this.traverse( ( child ) => {

			if ( child.isMesh ) {

				child.material.envMap = this.envMap;
				child.material.needsUpdate = true;

			}

		} );

		return this;

	}

	/**
	 * Polls data from the XRInputSource and updates the model's components to match
	 * the real world data
	 */
	updateMatrixWorld( force ) {

		super.updateMatrixWorld( force );

		if ( ! this.marker ) return;

	}

}

function addAssetSceneToMarkerModel( markerModel, scene ) {
	// Apply any environment map that the mesh already has set.
	if ( markerModel.envMap ) {
		scene.traverse( ( child ) => {
			if ( child.isMesh ) {
				child.material.envMap = markerModel.envMap;
				child.material.needsUpdate = true;
			}
		} );
	}

	// Add the glTF scene to the controllerModel.
	markerModel.add( scene );
}

class XRMarkerModelFactory {

	constructor( gltfLoader = null ) {

		this.gltfLoader = gltfLoader;
		this.path = MARKER_MODEL_PATH;
		this._assetCache = {};

		// If a GLTFLoader wasn't supplied to the constructor create a new one.
		if ( ! this.gltfLoader ) {
			this.gltfLoader = new GLTFLoader();
		}
	}

	createMarkerModel( marker ) {

		const markerModel = new XRMarkerModel();
		let scene = null;

		marker.addEventListener( 'connected', ( event ) => {

			const xrInputSource = event.data;

            markerModel.marker = new Marker(
                xrInputSource,
                this.path
            );

            const cachedAsset = this._assetCache[ markerModel.marker.assetUrl ];
            if ( cachedAsset ) {
                scene = cachedAsset.scene.children[0].children[0].children[0].children[0].children[0].clone();
                let scale = 0.01;
                scene.scale.set(scale, scale, scale);
                scene.rotateY( Math.PI ); // up
                addAssetSceneToMarkerModel( markerModel, scene );
            } else {
                if ( ! this.gltfLoader ) {
                    throw new Error( 'GLTFLoader not set.' );
                }

                this.gltfLoader.setPath( '' );
                this.gltfLoader.load( markerModel.marker.assetUrl, ( asset ) => {
                    this._assetCache[ markerModel.marker.assetUrl ] = asset;

                    // only keep the pen itself, remove the pen cap
                    scene = asset.scene.children[0].children[0].children[0].children[0].children[0].clone();
                    let scale = 0.01;
                    scene.scale.set(scale, scale, scale);
                    scene.rotateX( - Math.PI / 2); // up  
                    addAssetSceneToMarkerModel( markerModel, scene );
                },
                null,
                () => {
                    throw new Error( `Asset ${markerModel.marker.assetUrl} missing or malformed.` );
                } );
            }
		} );

		marker.addEventListener( 'disconnected', () => {

			markerModel.marker = null;
			markerModel.remove( scene );
			scene = null;

		} );

		return markerModel;

	}

}

class Marker {
    /**
     * @param {Object} xrInputSource - The XRInputSource to build the MotionController around
     * @param {Object} assetUrl
     */
    constructor(xrInputSource, assetUrl) {
      if (!xrInputSource) {
        throw new Error('No xrInputSource supplied');
      }
  
      this.xrInputSource = xrInputSource;
      this.assetUrl = assetUrl;
  
    }
  
    get gripSpace() {
      return this.xrInputSource.gripSpace;
    }
  
    get targetRaySpace() {
      return this.xrInputSource.targetRaySpace;
    }
}

export { XRMarkerModelFactory };