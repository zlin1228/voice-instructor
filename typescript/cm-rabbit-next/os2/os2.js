import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";

const OS2 = ({notSpeaking}) => {
  const mountRef = useRef(null);
  const [renderer, setRenderer] = useState();
  const [scene, setScene] = useState();
  const [camera, setCamera] = useState();
  const toendRef = useRef(false);

  function easing(t,b,c,d) {if((t/=d/2)<1)return c/2*t*t+b;return c/2*((t-=2)*t*t+2)+b;}

  useEffect(() => {
    if (scene && camera && renderer) {
        var length = 27,
		radius = 6,
		rotatevalue = 0.006,
		acceleration = 0,
		animatestep = 0,
		pi2 = Math.PI*2;

        const group = new THREE.Group();
        var mesh, ringcover, ring;

        mesh = new THREE.Mesh(
            new THREE.TubeGeometry(new (THREE.Curve.create(function() {},
                function(percent) {
    
                    var x = length*Math.sin(pi2*percent),
                        y = radius*Math.cos(pi2*3*percent),
                        z, t;
    
                    t = percent%0.25/0.25;
                    t = percent%0.25-(2*(1-t)*t* -0.0185 +t*t*0.25);
                    if (Math.floor(percent/0.25) == 0 || Math.floor(percent/0.25) == 2) {
                        t *= -1;
                    }
                    z = radius*Math.sin(pi2*2* (percent-t));
    
                    return new THREE.Vector3(x, y, z);
    
                }
            ))(), 200, 1.1, 2, true),
            new THREE.MeshBasicMaterial({
                color: 0xe0e0de
                // , wireframe: true
            })
        );
        group.add(mesh);
    
        ringcover = new THREE.Mesh(new THREE.PlaneGeometry(50, 15, 10), new THREE.MeshBasicMaterial({color: 0xd85036, opacity: 0, transparent: true}));
        ringcover.position.x = length+1;
        ringcover.rotation.y = Math.PI/2;
        group.add(ringcover);
    
        ring = new THREE.Mesh(new THREE.RingGeometry(6.25, 7.45, 200), new THREE.MeshBasicMaterial({color: 0xe0e0de, opacity: 0, transparent: true}));
        ring.position.x = length+1.1;
        ring.rotation.y = Math.PI/2;
        group.add(ring);

        // fake shadow
        (function() {
            var plain, i;
            for (i = 0; i < 10; i++) {
                plain = new THREE.Mesh(new THREE.PlaneGeometry(length*2+1, radius*3, 1), new THREE.MeshBasicMaterial({color: 0xd85036, transparent: true, opacity: 0.13}));
                plain.position.z = -2.5+i*0.5;
                group.add(plain);
            }
        })();

        scene.add(group);

        function render() {
            // console.log('render', toendRef.current);
            var progress;
    
            animatestep = Math.max(0, Math.min(240, toendRef.current ? animatestep+1 : animatestep-4));
            acceleration = easing(animatestep, 0, 1, 240);
    
            if (acceleration > 0.2) {
                progress = (acceleration-0.2)/0.8;
                group.rotation.y = -Math.PI/2 *progress;
                group.position.z = 50*progress;
                progress = Math.max(0, (acceleration-0.99)/0.01);
                mesh.material.opacity = 1-progress;
                ringcover.material.opacity = ring.material.opacity = progress;
                ring.scale.x = ring.scale.y = 0.9 + 0.1*progress;
            }
    
            renderer.render(scene, camera);
    
        }
    
        function animate() {
            //console.log("animate");
            mesh.rotation.x += rotatevalue + acceleration;
            render();
            requestAnimationFrame(animate);
        }

        let onWindowResize = function () {
            //if (camera) {
            //    camera.aspect = window.innerWidth / window.innerHeight;
            //}
            renderer.setSize(Math.min(window.innerWidth, window.innerHeight), Math.min(window.innerWidth, window.innerHeight));
        };

        window.addEventListener("resize", onWindowResize, false);

        animate();
    }
  }, [renderer, scene, camera]);

  useEffect(() => {
    if (notSpeaking) {
        toendRef.current = true;
    } else {
        toendRef.current = false;
    }
  }, [notSpeaking]);

  useEffect(() => {

    var _scene = new THREE.Scene();
    var _camera = new THREE.PerspectiveCamera(65, 1, 1, 10000);
	_camera.position.z = 200;
    
    var _renderer = new THREE.WebGLRenderer({antialias: true});
    _renderer.setPixelRatio(window.devicePixelRatio);
	_renderer.setClearColor('#d85036');

    let _onWindowResize = function () {
      //_camera.aspect = window.innerWidth / window.innerHeight;
      _renderer.setSize(Math.min(window.innerWidth, window.innerHeight), Math.min(window.innerWidth, window.innerHeight));
    };

    window.addEventListener("resize", _onWindowResize, false);

    setRenderer(_renderer);
    setScene(_scene);
    setCamera(_camera);

    _renderer.setSize(Math.min(window.innerWidth, window.innerHeight), Math.min(window.innerWidth, window.innerHeight));
    mountRef.current.appendChild(_renderer.domElement);

    return () => mountRef.current.removeChild(_renderer.domElement);
  }, []);

  return <div ref={mountRef}></div>;
};

export default OS2;