import * as T from 'three';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const TONGS_MODEL_PATH = '../models/tongs/scene.gltf';

class XRTongsModel extends T.Object3D {

	constructor() {

		super();

		this.tongs = null;
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

		if ( ! this.tongs ) return;

	}

}

function addAssetSceneToTongsModel( tongsModel, scene ) {
	// Apply any environment map that the mesh already has set.
	if ( tongsModel.envMap ) {
		scene.traverse( ( child ) => {
			if ( child.isMesh ) {
				child.material.envMap = tongsModel.envMap;
				child.material.needsUpdate = true;
			}
		} );
	}

	// Add the glTF scene to the controllerModel.
	tongsModel.add( scene );
}

class XRTongsModelFactory {

	constructor( gltfLoader = null ) {

		this.gltfLoader = gltfLoader;
		this.path = TONGS_MODEL_PATH;
		this._assetCache = {};

		// If a GLTFLoader wasn't supplied to the constructor create a new one.
		if ( ! this.gltfLoader ) {
			this.gltfLoader = new GLTFLoader();
		}
	}

	createTongsModel( tongs ) {

		const tongsModel = new XRTongsModel();
		let scene = null;

		tongs.addEventListener( 'connected', ( event ) => {

			const xrInputSource = event.data;

            tongsModel.tongs = new Tongs(
                xrInputSource,
                this.path
            );

            const cachedAsset = this._assetCache[ tongsModel.tongs.assetUrl ];
            if ( cachedAsset ) {
                scene = cachedAsset.scene.clone();
                let scale = 0.02;
                scene.scale.set(scale, scale, scale);
                scene.rotateY( Math.PI ); 
                addAssetSceneToTongsModel( tongsModel, scene );
            } else {
                if ( ! this.gltfLoader ) {
                    throw new Error( 'GLTFLoader not set.' );
                }

                this.gltfLoader.setPath( '' );
                this.gltfLoader.load( tongsModel.tongs.assetUrl, ( asset ) => {
                    this._assetCache[ tongsModel.tongs.assetUrl ] = asset;

					scene = asset.scene.clone();
					let scale = 0.02;
                    scene.scale.set(scale, scale, scale);
                    scene.rotateY( Math.PI ); 
                    addAssetSceneToTongsModel( tongsModel, scene );
                },
                null,
                () => {
                    throw new Error( `Asset ${tongsModel.tongs.assetUrl} missing or malformed.` );
                } );
            }
		} );

		tongs.addEventListener( 'disconnected', () => {

			tongsModel.tongs = null;
			tongsModel.remove( scene );
			scene = null;

		} );

		return tongsModel;

	}

}

class Tongs {
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

export { XRTongsModelFactory };