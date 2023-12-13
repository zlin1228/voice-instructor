import './Blob.css';
import React, { forwardRef, useRef, useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from './OrbitControls.js';
import { UnrealBloomPass, RenderPass, EffectComposer } from 'three-stdlib'
import BlobMaterial from './BlobMaterial';
import { useSpring } from 'react-spring';
import anime from 'animejs/lib/anime.es.js';

let WindowResize = function(renderer, camera, dimension){
	dimension 	= dimension || function(){ return { width: window.innerWidth, height: window.innerHeight } }
	var callback	= function(){
		// fetch target renderer size
		var rendererSize = dimension();
		// notify the renderer of the size change
		renderer.setSize( rendererSize.width, rendererSize.height )
		// update the camera
		camera.aspect	= rendererSize.width / rendererSize.height
		camera.updateProjectionMatrix()
	}
	// bind the resize event
	window.addEventListener('resize', callback, false)
	// return .stop() the function to stop watching window resize
	return {
		trigger	: function(){
			callback()
		},
		/**
		 * Stop watching window resize
		*/
		destroy	: function(){
			window.removeEventListener('resize', callback)
		}
	}
}

function Blob({loggedIn, speaking, thinking, playerPanel, hide}) {
  
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const renderedRef = useRef(false);
  const materialRef = useRef(null);
  const speedRef = useRef(0.35);
  const lightRef = useRef(null);

  const blobPropsRef = useRef({
    envMapIntensity: 0.2,
    clearColor: '#000000',
    speed: 0.04,
    lightIntensity: 0,
    frequency: 1.5,
    surfaceFrequency: 1.06,
    distort: 0.2,
    surfaceDistort: 0.7,
  });

  /**
 * Initializes a webcam video stream for an HTML video element
 * @param {HTMLVideoElement} videoElement 
 * @param {number} width
 * @param {number} height
 */
async function initWebcam(videoElement, width, height) {
  // create a video stream
  let stream;
  // only open stream on non-mobile devices
  if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {width, height, facingMode: 'user'},
      });
    } catch(error) {
      console.error('Unable to access the webcam.', error);
      return;
    }

    // apply the stream to the video element
    videoElement.srcObject = stream;
    videoElement.play();
  }
}

  function initRenderer(container) {
    rendererRef.current = new THREE.WebGL1Renderer( { alpha:true, antialias: true } );
    rendererRef.current.toneMapping = THREE.ACESFilmicToneMapping;
    rendererRef.current.setClearColor(0xc3cccf, 1);
    rendererRef.outputEncdoing = THREE.sRGBEncoding;
    rendererRef.current.setSize(container.offsetWidth, container.offsetHeight );
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    container.appendChild(rendererRef.current.domElement);
    return rendererRef.current;
  }

  function animate(renderer, scene, camera, update=() => {}, composer, lastTime=new Date(), totalTime=0) {
    const now = new Date();
    const dt = (now - lastTime) / 1000;
    const elapsed = totalTime + dt;
    update(elapsed, dt);
    requestAnimationFrame(() => animate(renderer, scene, camera, update, composer, now, elapsed));
    renderer.render(scene, camera);
    //composer.render();
  }

  function os2Blob(container) {
    if (renderedRef.current) return;
    renderedRef.current = true;

    // create the video element
    const videoElement = document.createElement('video');
    // set display style to none
    videoElement.style.display = 'none';
    
    // add video element to the DOM
    container.appendChild(videoElement);

    // initialize the webcam
    // const videoWidth = 1080, videoHeight = 720;
    // initWebcam(videoElement, videoWidth, videoHeight);
    
    const fallbackTexture = new THREE.TextureLoader().load('https://storage.googleapis.com/quantum-engine-public/bg.jpg'); 
    const gradientTexture = new THREE.TextureLoader().load('https://storage.googleapis.com/quantum-engine-public/textures/texture-2.png');

    //console.log(fallbackTexture);

    const videoTexture = new THREE.VideoTexture(videoElement);
    
    // create the shader material
    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: `#ifdef GL_ES
      precision highp float;
      #endif
    
      varying vec2 vUv;
      varying vec3 norm;
        
      void main()
      {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        norm = normal;
      }  
      `,
      fragmentShader: `#ifdef GL_ES
      precision highp float;
    #endif

    varying vec2 vUv;
    varying vec3 norm;
    uniform sampler2D texture;
    uniform sampler2D fallbackTexture;

    // Function to adjust saturation
    vec3 adjustSaturation(vec3 color, float saturation) {
        // Convert to grayscale using luminance values
        float gray = dot(color, vec3(0.299, 0.587, 0.114));
        return mix(vec3(gray), color, saturation);
    }

    // Function to adjust contrast
    vec3 adjustContrast(vec3 color, float contrast) {
        return (color - 0.5) * contrast + 0.5;
    }

    // Function to calculate the average brightness of a texture
    float averageBrightness(sampler2D tex) {
        float sum = 0.0;
        int numSamples = 0;

        for (int x = 0; x < 10; x++) {
            for (int y = 0; y < 10; y++) {
                vec2 uv = vec2(float(x) / 10.0, float(y) / 10.0);
                vec3 color = texture2D(tex, uv).rgb;
                float brightness = dot(color, vec3(0.299, 0.587, 0.114));
                sum += brightness;
                numSamples++;
            }
        }

        return sum / float(numSamples);
    }

    void main() {
        // Use the xy normal to look up the texture position
        // and convert the [-1, 1] range to [0, 1]
        vec2 lookup = (norm.xy + 1.0) / 2.0;

        // Generate an attenuation factor to darken the back
        float attenuation = min(1.0, norm.z + 1.0);

        // Flip the x component to mirror the image
        lookup.x = 1.0 - lookup.x;

        // Calculate the average brightness of the texture
        float brightness = averageBrightness(texture);

        // If the texture is too dark, use the fallback texture
        vec3 color;
        if (brightness < 0.1) { // Adjust this value to control the darkness threshold
            color = texture2D(fallbackTexture, lookup).rgb;
        } else {
            color = texture2D(fallbackTexture, lookup).rgb;
        }

        // Adjust contrast and saturation
        color = adjustSaturation(color, 0.6);
        color = adjustContrast(color, 1.2);

        gl_FragColor = vec4(color, 1.0);
    }`,
      uniforms: {
        texture: new THREE.Uniform(videoTexture),
        fallbackTexture: new THREE.Uniform(fallbackTexture),
      },
      side: THREE.DoubleSide,
    });
  
    // create a scene for the cubemap
    const cubeMapScene = new THREE.Scene();

    // Create cube render target
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget( 128, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter } );

    // Create cube camera
    const cubeCamera = new THREE.CubeCamera(1, 1000, cubeRenderTarget);
  
    const segments = 200;
    const scale = 1.7;

    // populate the cubemap scene with a sphere & shader
    const sphere = new THREE.SphereGeometry(scale, segments, segments);
    const sphereMesh = new THREE.Mesh(sphere, shaderMaterial);
    cubeMapScene.add(sphereMesh);
  
    // create a renderer, scene and camera
    const renderer = initRenderer(container);

    // SCENE
	  var scene = new THREE.Scene();
    // CAMERA
    var SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight;
    var VIEW_ANGLE = 45, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 0.1, FAR = 2000;
    var camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR);
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);

    const controls = new OrbitControls( camera, renderer.domElement );
    controls.minAzimuthAngle = -Math.PI / 4;
    controls.maxAzimuthAngle = Math.PI / 4;
    controls.minPolarAngle = Math.PI / 4;
    controls.maxPolarAngle = Math.PI / 2;
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.maxDistance = 30.0;
    controls.minDistance = 17.0;

    scene.add(camera);
    camera.position.set(0,18,36);
    camera.lookAt(scene.position);

    var winResize	= new WindowResize(renderer, camera);

    // LIGHT
    lightRef.current = new THREE.PointLight(0xffffff, 1);
    lightRef.current.position.set(12,12,12);
    scene.add(lightRef.current);

    // AMBIENT
    var ambientLight = new THREE.AmbientLight(0x222222);
    scene.add(ambientLight);
    
    controls.update();

    //const normalTexture = new THREE.CanvasTexture(new FlakesTexture());
    //normalTexture.wrapS = THREE.RepeatWrapping;
    //normalTexture.wrapT = THREE.RepeatWrapping;
    //normalTexture.repeat.set( 20, 12 );

    let composer;
    //const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.1, 1);
    //const composer = new EffectComposer(renderer);
    //composer.addPass(new RenderPass(scene, camera));
    //composer.addPass(bloomPass);

    const geometry = new THREE.SphereGeometry(scale, segments, segments);
    const material = new BlobMaterial( {
      color: 0xffffff,
      metalness: 1,
      roughness: 0.13,
      envMap: cubeRenderTarget.texture,
      envMapIntensity: 0.2,
      clearcoat: 0.43,
      clearcoatRoughness: 1,
      transmission: 1,
      //normalMap: normalTexture,
      //normalScale: new THREE.Vector2( 0.06, 0.06 ),
      map: gradientTexture,
    });

    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y += 1;
    scene.add(mesh);

    // Create a clock to keep track of elapsed time
    const clock = new THREE.Clock();

    function update(t, dt) {
      cubeCamera.update(renderer, cubeMapScene);
      
      // wiggle the mesh a bit
      //mesh.rotation.y = Math.sin(t);
      //mesh.rotation.x = Math.cos(t * 0.8);

      material.setTime(clock.getElapsedTime() * speedRef.current);
      material.setSurfaceTime(clock.getElapsedTime() * speedRef.current);

      controls.update();
    }
    
    animate(renderer, scene, camera, update, composer);
  }

  useEffect(() => {
    if (containerRef.current) {
      os2Blob(containerRef.current);
    }
  }, [containerRef]);

  const propagateBlobProp = () => {
    rendererRef.current.setClearColor(blobPropsRef.current.clearColor, 1);
    lightRef.current.intensity = blobPropsRef.current.lightIntensity;
    materialRef.current.envMapIntensity = blobPropsRef.current.envMapIntensity;
    materialRef.current.setFrequency(blobPropsRef.current.frequency);
    materialRef.current.setSurfaceFrequency(blobPropsRef.current.surfaceFrequency);
    materialRef.current.setDistort(blobPropsRef.current.distort);
    materialRef.current.setSurfaceDistort(blobPropsRef.current.surfaceDistort);
  };

  useEffect(() => {
    if (materialRef.current) {
      if (loggedIn && !speaking && !thinking) {
        anime(
          {
            targets: blobPropsRef.current,
            envMapIntensity: 1.1,
            clearColor: '#000000',
            speed: 0.1,
            lightIntensity: 1,
            frequency: 1.5,
            surfaceFrequency: 1.06,
            distort: 0.2,
            surfaceDistort: 0.7,
            duration: 950,
            easing: 'linear',
            update: propagateBlobProp,
          }
        );
        speedRef.current = 0.1;
      }
      else if (loggedIn && !speaking && thinking) {
        anime(
          {
            targets: blobPropsRef.current,
            envMapIntensity: 1.1,
            clearColor: '#000000',
            speed: 0.5,
            lightIntensity: 1,
            frequency: 1.2,
            surfaceFrequency: 0.8,
            distort: 0.25,
            surfaceDistort: 0.8,
            duration: 950,
            easing: 'linear',
            update: propagateBlobProp,
          }
        );
        speedRef.current = 0.5;
      }
      else if (loggedIn && speaking) {
        anime(
          {
            targets: blobPropsRef.current,
            envMapIntensity: 1.1,
            clearColor: '#000000',
            speed: 1.5,
            lightIntensity: 1,
            frequency: 1.5,
            surfaceFrequency: 1.06,
            distort: 0.25,
            surfaceDistort: 0.8,
            duration: 950,
            easing: 'linear',
            update: propagateBlobProp,
          }
        );
        speedRef.current = 1.5;
      }
      else {
        anime(
          {
            targets: blobPropsRef.current,
            envMapIntensity: 0.5,
            clearColor: '#000000',
            speed: 0.02,
            lightIntensity: 0.8,
            frequency: 1.5,
            surfaceFrequency: 1.06,
            distort: 0.2,
            surfaceDistort: 0.7,
            duration: 950,
            easing: 'linear',
            update: propagateBlobProp,
          }
        );
        speedRef.current = 0.04;
      }
  
    }
  }, [loggedIn, speaking, thinking]);

  
  return (
    <div className="Blob" style={{
      position: 'absolute',
      top: playerPanel ? '-10vh' : '',
      transition: "all 0.2s linear",
      opacity: hide ? 0 : 1,
      // zIndex: 1,
    }}>
      <div
        ref={containerRef}
        style={{
          width: '100vw',
          height: '100vh',
        }}
      >
      </div>
    </div>
  );
}

export default Blob;