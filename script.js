(() => {
    const demos = [
        {
            rank: 1,
            title: "State of the Art",
            group: "Spaceballs",
            url: "https://www.pouet.net/prod.php?which=99",
            effect: "Wireframe skyline flythrough + scanline glow",
            factory: createWireCity,
        },
        {
            rank: 2,
            title: "Eon",
            group: "The Black Lotus",
            url: "https://www.pouet.net/prod.php?which=81094",
            effect: "Neon tunnel shader with spiral rings",
            factory: createTunnel,
        },
        {
            rank: 3,
            title: "Hardwired",
            group: "Crionics & The Silents",
            url: "https://www.pouet.net/prod.php?which=981",
            effect: "Morphing particle sculpture",
            factory: createMorphParticles,
        },
        {
            rank: 4,
            title: "Desert Dream",
            group: "Kefrens",
            url: "https://www.pouet.net/prod.php?which=1483",
            effect: "Wireframe dunes + sun horizon",
            factory: createDesertDream,
        },
        {
            rank: 5,
            title: "Batman Rises",
            group: "Batman Group",
            url: "https://www.pouet.net/prod.php?which=93011",
            effect: "Bat silhouette with particle ring",
            factory: createBatmanRises,
        },
        {
            rank: 6,
            title: "Rink a Dink: REDUX",
            group: "Lemon.",
            url: "https://www.pouet.net/prod.php?which=61182",
            effect: "Metaball plasma shader",
            factory: createMetaballs,
        },
        {
            rank: 7,
            title: "ARTE",
            group: "Sanity",
            url: "https://www.pouet.net/prod.php?which=1477",
            effect: "Kaleidoscopic vector symmetry",
            factory: createArte,
        },
        {
            rank: 8,
            title: "Enigma",
            group: "Phenomena",
            url: "https://www.pouet.net/prod.php?which=394",
            effect: "Wireframe core + starfield drift",
            factory: createEnigma,
        },
        {
            rank: 9,
            title: "9 Fingers",
            group: "Spaceballs",
            url: "https://www.pouet.net/prod.php?which=100",
            effect: "Dot‑matrix wavefield",
            factory: createNineFingers,
        },
        {
            rank: 10,
            title: "Hologon",
            group: "The Electronic Knights",
            url: "https://www.pouet.net/prod.php?which=88025",
            effect: "Holographic torus knot",
            factory: createHologon,
        },
    ];

    const canvas = document.getElementById("demo-canvas");
    const stageTitle = document.getElementById("stage-title");
    const stageMeta = document.getElementById("stage-meta");
    const stageDesc = document.getElementById("stage-desc");
    const stageLink = document.getElementById("stage-link");
    const stageIndex = document.getElementById("stage-index");
    const grid = document.getElementById("demo-grid");
    const cycleBtn = document.getElementById("cycle");
    const pauseBtn = document.getElementById("pause");

    if (!canvas || !window.THREE) {
        return;
    }

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    let currentIndex = 0;
    let currentEffect = null;
    let lastTime = 0;
    let cycleTimer = null;

    const updateUI = (index) => {
        const demo = demos[index];
        stageTitle.textContent = demo.title;
        stageMeta.textContent = `${demo.group} · Amiga OCS/ECS demo`;
        stageDesc.textContent = demo.effect;
        stageLink.href = demo.url;
        stageIndex.textContent = `${index + 1} / ${demos.length}`;
    };

    const disposeScene = (scene) => {
        scene.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach((mat) => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    };

    const setEffect = (index) => {
        if (currentEffect) {
            disposeScene(currentEffect.scene);
        }
        currentIndex = index;
        updateUI(index);
        currentEffect = demos[index].factory(renderer);
        resize();
    };

    const resize = () => {
        const { clientWidth, clientHeight } = canvas.parentElement;
        renderer.setSize(clientWidth, clientHeight, false);
        if (currentEffect?.onResize) {
            currentEffect.onResize(clientWidth, clientHeight);
        }
    };

    const animate = (time) => {
        const t = time * 0.001;
        const dt = Math.min(t - lastTime, 0.033);
        lastTime = t;
        if (currentEffect?.update) {
            currentEffect.update(t, dt);
        }
        if (currentEffect?.scene && currentEffect?.camera) {
            renderer.render(currentEffect.scene, currentEffect.camera);
        }
        requestAnimationFrame(animate);
    };

    const startCycle = () => {
        if (cycleTimer) return;
        cycleTimer = setInterval(() => {
            setEffect((currentIndex + 1) % demos.length);
        }, 24000);
    };

    const stopCycle = () => {
        if (!cycleTimer) return;
        clearInterval(cycleTimer);
        cycleTimer = null;
    };

    const buildCards = () => {
        grid.innerHTML = "";
        demos.forEach((demo, index) => {
            const card = document.createElement("div");
            card.className = "demo-card";
            card.innerHTML = `
                <div class="demo-rank">#${demo.rank}</div>
                <div class="demo-title">${demo.title}</div>
                <div class="demo-meta">${demo.group}</div>
                <div class="demo-effect">${demo.effect}</div>
                <div class="demo-actions">
                    <span>Load effect</span>
                    <a href="${demo.url}" target="_blank" rel="noopener">Pouet</a>
                </div>
            `;
            card.addEventListener("click", () => {
                stopCycle();
                setEffect(index);
            });
            grid.appendChild(card);
        });
    };

    cycleBtn?.addEventListener("click", startCycle);
    pauseBtn?.addEventListener("click", stopCycle);

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", (event) => {
        if (event.code === "Space") {
            event.preventDefault();
            if (cycleTimer) {
                stopCycle();
            } else {
                startCycle();
            }
        }
    });

    buildCards();
    setEffect(0);
    resize();
    requestAnimationFrame(animate);

    const TWO_PI = Math.PI * 2;

    function seededRandom(seed = 1) {
        let value = seed >>> 0;
        return () => {
            value = (value * 1664525 + 1013904223) % 4294967296;
            return value / 4294967296;
        };
    }

    function createWireCity() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050509);
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
        camera.position.set(0, 12, 22);
        camera.lookAt(0, 5, -30);

        const group = new THREE.Group();
        const rand = seededRandom(42);
        const width = 12;
        const depth = 40;
        const spacing = 3.6;
        const geometry = new THREE.BoxGeometry(2.2, 1, 2.2);
        const material = new THREE.MeshBasicMaterial({ color: 0x63f5ff, wireframe: true });

        for (let z = 0; z < depth; z += 1) {
            for (let x = 0; x < width; x += 1) {
                const height = 1 + Math.pow(rand(), 1.7) * 16;
                const mesh = new THREE.Mesh(geometry, material);
                mesh.scale.y = height;
                mesh.position.set((x - width / 2) * spacing, height / 2, -z * spacing);
                group.add(mesh);
            }
        }
        scene.add(group);

        let scroll = 0;
        return {
            scene,
            camera,
            update: (t, dt) => {
                scroll += dt * 6;
                group.position.z = scroll % spacing;
                group.rotation.y = Math.sin(t * 0.3) * 0.07;
            },
            onResize: (w, h) => {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            },
        };
    }

    function createTunnel() {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const uniforms = {
            uTime: { value: 0 },
        };
        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                varying vec2 vUv;
                uniform float uTime;
                const float PI = 3.14159265359;

                void main() {
                    vec2 p = vUv * 2.0 - 1.0;
                    float r = length(p) + 0.05;
                    float a = atan(p.y, p.x);
                    float t = uTime * 0.7;
                    float tunnel = 0.25 / r;
                    float rings = sin(10.0 / r - t * 3.2);
                    float swirl = sin(6.0 * a + t * 2.0);
                    float glow = smoothstep(1.2, 0.0, r);
                    vec3 col = vec3(0.08, 0.2, 0.7) * tunnel;
                    col += vec3(0.8, 0.2, 0.9) * swirl * 0.15;
                    col += vec3(0.2, 0.8, 0.9) * rings * 0.25;
                    col *= glow;
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        return {
            scene,
            camera,
            update: (t) => {
                uniforms.uTime.value = t;
            },
        };
    }

    function createMorphParticles() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050509);
        const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
        camera.position.set(0, 0, 18);

        const count = 2600;
        const positions = new Float32Array(count * 3);
        const sphere = new Float32Array(count * 3);
        const torus = new Float32Array(count * 3);

        for (let i = 0; i < count; i += 1) {
            const i3 = i * 3;
            const u = Math.random();
            const v = Math.random();
            const theta = Math.acos(2 * u - 1);
            const phi = TWO_PI * v;
            const radius = 6;
            sphere[i3] = radius * Math.sin(theta) * Math.cos(phi);
            sphere[i3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
            sphere[i3 + 2] = radius * Math.cos(theta);

            const u2 = TWO_PI * Math.random();
            const v2 = TWO_PI * Math.random();
            const major = 5.5;
            const minor = 2.2;
            torus[i3] = (major + minor * Math.cos(v2)) * Math.cos(u2);
            torus[i3 + 1] = (major + minor * Math.cos(v2)) * Math.sin(u2);
            torus[i3 + 2] = minor * Math.sin(v2);

            positions[i3] = sphere[i3];
            positions[i3 + 1] = sphere[i3 + 1];
            positions[i3 + 2] = sphere[i3 + 2];
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: 0xff79d6,
            size: 0.12,
            transparent: true,
            opacity: 0.9,
        });
        const points = new THREE.Points(geometry, material);
        scene.add(points);

        return {
            scene,
            camera,
            update: (t, dt) => {
                const morph = (Math.sin(t * 0.6) + 1) / 2;
                for (let i = 0; i < count; i += 1) {
                    const i3 = i * 3;
                    positions[i3] = THREE.MathUtils.lerp(sphere[i3], torus[i3], morph);
                    positions[i3 + 1] = THREE.MathUtils.lerp(sphere[i3 + 1], torus[i3 + 1], morph);
                    positions[i3 + 2] = THREE.MathUtils.lerp(sphere[i3 + 2], torus[i3 + 2], morph);
                }
                geometry.attributes.position.needsUpdate = true;
                points.rotation.y += dt * 0.4;
                points.rotation.x += dt * 0.2;
            },
            onResize: (w, h) => {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            },
        };
    }

    function createDesertDream() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a0f0a);
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
        camera.position.set(0, 12, 20);
        camera.lookAt(0, 0, -15);

        const geometry = new THREE.PlaneGeometry(80, 80, 120, 120);
        geometry.rotateX(-Math.PI / 2);
        const material = new THREE.MeshBasicMaterial({
            color: 0xd9a85c,
            wireframe: true,
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const sun = new THREE.Mesh(
            new THREE.SphereGeometry(3, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0xffd28a })
        );
        sun.position.set(0, 14, -30);
        scene.add(sun);

        const positions = geometry.attributes.position;
        const base = positions.array.slice();

        return {
            scene,
            camera,
            update: (t) => {
                for (let i = 0; i < positions.count; i += 1) {
                    const x = base[i * 3];
                    const z = base[i * 3 + 2];
                    const y =
                        Math.sin(x * 0.12 + t * 0.8) * 1.3 +
                        Math.cos(z * 0.1 + t * 0.6) * 1.7;
                    positions.setY(i, y);
                }
                positions.needsUpdate = true;
            },
            onResize: (w, h) => {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            },
        };
    }

    function createBatmanRises() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x140c1d);
        const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
        camera.position.set(0, 2, 18);

        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(1.2, 2.6);
        shape.lineTo(3.4, 1.6);
        shape.lineTo(4.8, 3.8);
        shape.lineTo(7.2, 2.4);
        shape.lineTo(5.8, 6.4);
        shape.lineTo(3.2, 4.6);
        shape.lineTo(1.4, 6.6);
        shape.lineTo(0, 5.0);
        shape.lineTo(-1.4, 6.6);
        shape.lineTo(-3.2, 4.6);
        shape.lineTo(-5.8, 6.4);
        shape.lineTo(-7.2, 2.4);
        shape.lineTo(-4.8, 3.8);
        shape.lineTo(-3.4, 1.6);
        shape.lineTo(-1.2, 2.6);
        shape.closePath();

        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
        const material = new THREE.MeshStandardMaterial({
            color: 0x0a0a0f,
            emissive: 0x240012,
            metalness: 0.2,
            roughness: 0.7,
        });
        const bat = new THREE.Mesh(geometry, material);
        bat.rotation.x = -0.2;
        bat.position.y = 1;
        scene.add(bat);

        const ringGeo = new THREE.RingGeometry(8, 11, 80);
        const ringMat = new THREE.PointsMaterial({
            color: 0xff4f86,
            size: 0.08,
            transparent: true,
            opacity: 0.7,
        });
        const ring = new THREE.Points(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -1.5;
        scene.add(ring);

        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const light = new THREE.PointLight(0xff5c8a, 1.2, 50);
        light.position.set(6, 8, 8);
        scene.add(light);

        return {
            scene,
            camera,
            update: (t) => {
                bat.rotation.y = Math.sin(t * 0.5) * 0.4;
                ring.rotation.z = t * 0.2;
            },
            onResize: (w, h) => {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            },
        };
    }

    function createMetaballs() {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const balls = Array.from({ length: 5 }, () => new THREE.Vector3());
        const uniforms = {
            uTime: { value: 0 },
            uBalls: { value: balls },
        };

        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                varying vec2 vUv;
                uniform vec3 uBalls[5];
                uniform float uTime;

                void main() {
                    float field = 0.0;
                    for (int i = 0; i < 5; i++) {
                        vec2 pos = uBalls[i].xy;
                        float radius = uBalls[i].z;
                        float d = distance(vUv, pos) + 0.001;
                        field += (radius * radius) / (d * d);
                    }
                    float glow = smoothstep(1.0, 2.8, field);
                    vec3 col = mix(vec3(0.02, 0.04, 0.08), vec3(0.1, 0.8, 0.7), glow);
                    col += vec3(0.7, 0.2, 0.9) * field * 0.12;
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        return {
            scene,
            camera,
            update: (t) => {
                uniforms.uTime.value = t;
                balls.forEach((ball, i) => {
                    const speed = 0.5 + i * 0.2;
                    const offset = i * 1.4;
                    ball.x = 0.5 + 0.28 * Math.sin(t * speed + offset);
                    ball.y = 0.5 + 0.26 * Math.cos(t * speed + offset * 1.2);
                    ball.z = 0.2 + 0.08 * Math.sin(t * 0.7 + offset);
                });
            },
        };
    }

    function createArte() {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const uniforms = {
            uTime: { value: 0 },
        };
        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                varying vec2 vUv;
                uniform float uTime;
                const float PI = 3.14159265359;

                vec2 kaleido(vec2 p, float sides) {
                    float angle = atan(p.y, p.x);
                    float radius = length(p);
                    float slice = PI * 2.0 / sides;
                    angle = mod(angle, slice);
                    angle = abs(angle - slice * 0.5);
                    return radius * vec2(cos(angle), sin(angle));
                }

                void main() {
                    vec2 p = vUv * 2.0 - 1.0;
                    vec2 k = kaleido(p, 8.0);
                    float wave = sin((k.x + k.y) * 6.0 + uTime * 1.4);
                    float pulse = cos(length(k) * 8.0 - uTime * 2.0);
                    vec3 col = vec3(0.15, 0.6, 1.0) * (0.4 + 0.6 * wave);
                    col += vec3(1.0, 0.3, 0.8) * (0.3 + 0.7 * pulse);
                    col *= smoothstep(1.2, 0.0, length(p));
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);
        return {
            scene,
            camera,
            update: (t) => {
                uniforms.uTime.value = t;
            },
        };
    }

    function createEnigma() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x07080f);
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
        camera.position.set(0, 0, 18);

        const coreGeo = new THREE.IcosahedronGeometry(5, 0);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0x5cf2ff, wireframe: true });
        const core = new THREE.Mesh(coreGeo, coreMat);
        scene.add(core);

        const starCount = 1200;
        const starPositions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i += 1) {
            const i3 = i * 3;
            starPositions[i3] = (Math.random() - 0.5) * 80;
            starPositions[i3 + 1] = (Math.random() - 0.5) * 80;
            starPositions[i3 + 2] = (Math.random() - 0.5) * 80;
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
        const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, opacity: 0.6, transparent: true });
        const stars = new THREE.Points(starGeo, starMat);
        scene.add(stars);

        return {
            scene,
            camera,
            update: (t, dt) => {
                core.rotation.y += dt * 0.6;
                core.rotation.x += dt * 0.3;
                stars.rotation.y += dt * 0.1;
            },
            onResize: (w, h) => {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            },
        };
    }

    function createNineFingers() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050509);
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
        camera.position.set(0, 8, 16);
        camera.lookAt(0, 0, 0);

        const size = 50;
        const spacing = 0.4;
        const count = size * size;
        const positions = new Float32Array(count * 3);
        let idx = 0;
        for (let x = 0; x < size; x += 1) {
            for (let z = 0; z < size; z += 1) {
                positions[idx] = (x - size / 2) * spacing;
                positions[idx + 1] = 0;
                positions[idx + 2] = (z - size / 2) * spacing;
                idx += 3;
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: 0x88f6ff,
            size: 0.12,
            transparent: true,
            opacity: 0.9,
        });
        const points = new THREE.Points(geometry, material);
        scene.add(points);

        return {
            scene,
            camera,
            update: (t) => {
                const pos = geometry.attributes.position;
                for (let i = 0; i < pos.count; i += 1) {
                    const x = pos.getX(i);
                    const z = pos.getZ(i);
                    const y = Math.sin(x * 0.4 + t * 1.4) * 0.6 + Math.cos(z * 0.3 + t) * 0.6;
                    pos.setY(i, y);
                }
                pos.needsUpdate = true;
            },
            onResize: (w, h) => {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            },
        };
    }

    function createHologon() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x05070c);
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
        camera.position.set(0, 2, 18);

        const knotGeo = new THREE.TorusKnotGeometry(4.6, 1.3, 220, 12);
        const edges = new THREE.EdgesGeometry(knotGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x7cf9ff, transparent: true, opacity: 0.8 });
        const line = new THREE.LineSegments(edges, lineMat);
        scene.add(line);

        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x48d7ff,
            transparent: true,
            opacity: 0.15,
            wireframe: true,
            blending: THREE.AdditiveBlending,
        });
        const glow = new THREE.Mesh(knotGeo, glowMat);
        scene.add(glow);

        return {
            scene,
            camera,
            update: (t, dt) => {
                line.rotation.y += dt * 0.6;
                line.rotation.x += dt * 0.3;
                glow.rotation.y -= dt * 0.2;
            },
            onResize: (w, h) => {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            },
        };
    }
})();
