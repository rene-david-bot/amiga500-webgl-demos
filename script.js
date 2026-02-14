(() => {
    const effects = [
        {
            rank: 1,
            title: "Copper Bars",
            category: "Raster & palette",
            url: "https://demo-effects.sourceforge.net/",
            effect: "Scrolling raster bars with metallic gradients",
            factory: createCopperBars,
        },
        {
            rank: 2,
            title: "Plasma",
            category: "Math & color",
            url: "https://lodev.org/cgtutor/plasma.html",
            effect: "Sine‑mixed color field with palette cycling",
            factory: createPlasma,
        },
        {
            rank: 3,
            title: "Rotozoomer",
            category: "Texture warps",
            url: "https://seancode.com/demofx",
            effect: "Rotating + zooming bitmap with affine mapping",
            factory: createRotozoom,
        },
        {
            rank: 4,
            title: "Tunnel",
            category: "Texture warps",
            url: "https://lodev.org/cgtutor/tunnel.html",
            effect: "Polar texture tunnel flythrough",
            factory: createTunnel,
        },
        {
            rank: 5,
            title: "Starfield",
            category: "3D illusion",
            url: "https://demo-effects.sourceforge.net/",
            effect: "3D stars with perspective depth",
            factory: createStarfield,
        },
        {
            rank: 6,
            title: "Metaballs (Vector Balls)",
            category: "3D illusion",
            url: "https://demo-effects.sourceforge.net/",
            effect: "Blobby spheres that merge and split",
            factory: createMetaballs,
        },
        {
            rank: 7,
            title: "Kaleidoscope",
            category: "Distortion",
            url: "https://democyclopedia.wordpress.com/2015/10/25/liste-des-effets",
            effect: "Mirrored wedges from a rotating source",
            factory: createKaleidoscope,
        },
        {
            rank: 8,
            title: "Sine Scroller",
            category: "Text & logos",
            url: "https://demo-effects.sourceforge.net/",
            effect: "Scrolling text on a sine wave",
            factory: createSineScroller,
        },
        {
            rank: 9,
            title: "Sprite Bobs",
            category: "Sprites",
            url: "https://democyclopedia.wordpress.com/2015/10/25/liste-des-effets",
            effect: "Multiplexed bouncing sprite blobs",
            factory: createBobs,
        },
        {
            rank: 10,
            title: "Fake 3D Floor",
            category: "Early 3D",
            url: "https://demo-effects.sourceforge.net/",
            effect: "Perspective checkerboard plane",
            factory: createFake3DFloor,
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
    const audioBtn = document.getElementById("audio-toggle");
    const audioStatus = document.getElementById("audio-status");

    function showWebGLWarning(message) {
        const wrap = canvas?.parentElement;
        if (!wrap) return;
        let warning = wrap.querySelector(".webgl-warning");
        if (!warning) {
            warning = document.createElement("div");
            warning.className = "webgl-warning";
            wrap.appendChild(warning);
        }
        warning.textContent = message;
    }

    if (!canvas) {
        return;
    }

    const chip = createChiptune(audioBtn, audioStatus);
    audioBtn?.addEventListener("click", chip.toggle);

    if (!window.THREE) {
        showWebGLWarning("Three.js failed to load — WebGL effects unavailable.");
        return;
    }

    const isAutomated = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    if (isAutomated) {
        showWebGLWarning("WebGL is disabled in automated browser sessions.");
        return;
    }

    const gl = canvas.getContext("webgl", {
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: false,
    });

    if (!gl) {
        showWebGLWarning("WebGL is not available in this browser/session.");
        return;
    }

    canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        showWebGLWarning("WebGL context lost. Please reload the page.");
    });

    let renderer = null;
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            context: gl,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
        });
    } catch (error) {
        console.error = originalConsoleError;
        showWebGLWarning("WebGL context could not be created in this session.");
        return;
    }
    console.error = originalConsoleError;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    if (renderer.outputColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    let currentIndex = 0;
    let currentEffect = null;
    let lastTime = 0;
    let cycleTimer = null;

    const updateUI = (index) => {
        const effect = effects[index];
        stageTitle.textContent = effect.title;
        stageMeta.textContent = `${effect.category} · Classic Amiga effect`;
        stageDesc.textContent = effect.effect;
        stageLink.href = effect.url;
        stageIndex.textContent = `${index + 1} / ${effects.length}`;
    };

    // webgl warning helper declared above

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
        currentEffect = effects[index].factory(renderer);
        resize();
    };

    const resize = () => {
        const wrap = canvas.parentElement || canvas;
        const rect = wrap.getBoundingClientRect();
        const width = Math.max(1, rect.width || wrap.clientWidth || 640);
        const height = Math.max(1, rect.height || wrap.clientHeight || 360);
        renderer.setSize(width, height, false);
        if (currentEffect?.onResize) {
            currentEffect.onResize(width, height);
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
            setEffect((currentIndex + 1) % effects.length);
        }, 22000);
    };

    const stopCycle = () => {
        if (!cycleTimer) return;
        clearInterval(cycleTimer);
        cycleTimer = null;
    };

    const buildCards = () => {
        grid.innerHTML = "";
        effects.forEach((effect, index) => {
            const card = document.createElement("div");
            card.className = "demo-card";
            card.innerHTML = `
                <div class="demo-rank">#${effect.rank}</div>
                <div class="demo-title">${effect.title}</div>
                <div class="demo-meta">${effect.category}</div>
                <div class="demo-effect">${effect.effect}</div>
                <div class="demo-actions">
                    <span>Load effect</span>
                    <a href="${effect.url}" target="_blank" rel="noopener">Reference</a>
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

    const FULLSCREEN_VERTEX = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `;

    const PRECISION_HEADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

    const withSafePrecision = (source) =>
        `${PRECISION_HEADER}
${source.replace(/precision\s+(highp|mediump|lowp)\s+float;\s*/g, "")}`;


    function createFullscreenEffect(fragmentShader, extraUniforms = {}) {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;
        const uniforms = {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(1, 1) },
            ...extraUniforms,
        };
        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: FULLSCREEN_VERTEX,
            fragmentShader: withSafePrecision(fragmentShader),
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        mesh.frustumCulled = false;
        scene.add(mesh);
        return {
            scene,
            camera,
            uniforms,
            update: (t) => {
                uniforms.uTime.value = t;
            },
            onResize: (w, h) => {
                uniforms.uResolution.value.set(w, h);
            },
        };
    }

    function createCopperBars() {
        return createFullscreenEffect(`
            precision highp float;
            varying vec2 vUv;
            uniform float uTime;

            void main() {
                vec2 p = vUv * 2.0 - 1.0;
                float t = uTime * 0.8;
                float bars = 0.0;
                for (int i = 0; i < 5; i++) {
                    float fi = float(i);
                    float center = sin(t * 0.9 + fi * 1.3) * 0.55 + (fi - 2.0) * 0.12;
                    float dist = abs(p.y - center);
                    float bar = smoothstep(0.18, 0.0, dist);
                    bars += bar;
                }
                float sheen = 0.6 + 0.4 * sin((p.y + t * 0.6) * 20.0);
                vec3 base = vec3(0.03, 0.02, 0.04);
                vec3 copper = vec3(1.0, 0.5, 0.12);
                vec3 glow = vec3(0.9, 0.3, 0.1);
                vec3 col = base + copper * bars * sheen;
                col += glow * bars * 0.35;
                gl_FragColor = vec4(col, 1.0);
            }
        `);
    }

    function createPlasma() {
        return createFullscreenEffect(`
            precision highp float;
            varying vec2 vUv;
            uniform float uTime;
            const float PI = 3.14159265359;

            void main() {
                vec2 p = vUv * 2.0 - 1.0;
                float t = uTime * 0.7;
                float v = sin(p.x * 3.0 + t) + sin(p.y * 4.0 - t * 1.3);
                v += sin((p.x + p.y) * 2.5 + t * 0.9);
                v += sin(length(p) * 5.0 - t * 1.4);
                float c = 0.5 + 0.5 * sin(v);
                vec3 palette = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + c));
                gl_FragColor = vec4(palette, 1.0);
            }
        `);
    }

    function createRotozoom() {
        return createFullscreenEffect(`
            precision highp float;
            varying vec2 vUv;
            uniform float uTime;
            const float PI = 3.14159265359;

            float checker(vec2 uv) {
                vec2 c = floor(uv);
                return mod(c.x + c.y, 2.0);
            }

            void main() {
                vec2 p = vUv * 2.0 - 1.0;
                float angle = uTime * 0.4;
                float zoom = 1.2 + 0.6 * sin(uTime * 0.6);
                mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                vec2 uv = rot * p * zoom;
                vec2 tile = uv * 4.0;
                float board = checker(tile);
                float stripes = 0.5 + 0.5 * sin(tile.x * PI + uTime * 1.2);
                vec3 colA = vec3(0.12, 0.8, 0.9);
                vec3 colB = vec3(0.8, 0.2, 0.9);
                vec3 col = mix(colA, colB, board);
                col *= 0.6 + 0.4 * stripes;
                gl_FragColor = vec4(col, 1.0);
            }
        `);
    }

    function createTunnel() {
        return createFullscreenEffect(`
            precision highp float;
            varying vec2 vUv;
            uniform float uTime;
            const float PI = 3.14159265359;

            void main() {
                vec2 p = vUv * 2.0 - 1.0;
                float r = length(p);
                float a = atan(p.y, p.x);
                float t = uTime * 0.6;
                float u = a / (2.0 * PI) + t * 0.08;
                float v = 1.0 / (r + 0.25) + t * 0.9;
                vec2 uv = vec2(u, v);
                float stripes = 0.5 + 0.5 * sin((uv.y + uv.x) * 6.0);
                float rings = 0.5 + 0.5 * cos(uv.y * 4.0);
                vec3 col = vec3(0.06, 0.2, 0.5) * stripes + vec3(0.7, 0.3, 0.9) * rings * 0.7;
                col *= smoothstep(1.2, 0.0, r);
                gl_FragColor = vec4(col, 1.0);
            }
        `);
    }

    function createStarfield() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x03040c);
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 120);
        camera.position.z = 12;

        const starCount = 1400;
        const positions = new Float32Array(starCount * 3);
        const speeds = new Float32Array(starCount);
        for (let i = 0; i < starCount; i += 1) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 40;
            positions[i3 + 1] = (Math.random() - 0.5) * 24;
            positions[i3 + 2] = -Math.random() * 80;
            speeds[i] = 0.3 + Math.random() * 1.2;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.18,
            transparent: true,
            opacity: 0.9,
        });
        const stars = new THREE.Points(geometry, material);
        scene.add(stars);

        return {
            scene,
            camera,
            update: (t, dt) => {
                const pos = geometry.attributes.position;
                for (let i = 0; i < starCount; i += 1) {
                    const i3 = i * 3;
                    let z = pos.getZ(i) + dt * (8 + speeds[i] * 10);
                    if (z > 8) {
                        z = -80;
                        pos.setX(i, (Math.random() - 0.5) * 40);
                        pos.setY(i, (Math.random() - 0.5) * 24);
                    }
                    pos.setZ(i, z);
                }
                pos.needsUpdate = true;
                stars.rotation.z = Math.sin(t * 0.1) * 0.02;
            },
            onResize: (w, h) => {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            },
        };
    }

    function createMetaballs() {
        const balls = Array.from({ length: 6 }, () => new THREE.Vector3());
        const effect = createFullscreenEffect(
            `
            precision highp float;
            varying vec2 vUv;
            uniform vec3 uBalls[6];

            void main() {
                float field = 0.0;
                for (int i = 0; i < 6; i++) {
                    vec2 pos = uBalls[i].xy;
                    float radius = uBalls[i].z;
                    float d = distance(vUv, pos) + 0.001;
                    field += (radius * radius) / (d * d);
                }
                float glow = smoothstep(1.0, 2.4, field);
                vec3 col = mix(vec3(0.02, 0.03, 0.06), vec3(0.1, 0.8, 0.7), glow);
                col += vec3(0.8, 0.2, 0.9) * field * 0.08;
                gl_FragColor = vec4(col, 1.0);
            }
        `,
            { uBalls: { value: balls } }
        );

        return {
            ...effect,
            update: (t) => {
                effect.uniforms.uTime.value = t;
                balls.forEach((ball, i) => {
                    const speed = 0.4 + i * 0.18;
                    const offset = i * 1.3;
                    ball.x = 0.5 + 0.32 * Math.sin(t * speed + offset);
                    ball.y = 0.5 + 0.28 * Math.cos(t * speed + offset * 1.2);
                    ball.z = 0.18 + 0.08 * Math.sin(t * 0.7 + offset);
                });
            },
        };
    }

    function createKaleidoscope() {
        return createFullscreenEffect(`
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
                float t = uTime * 0.6;
                float wave = sin((k.x + k.y) * 6.0 + t * 2.0);
                float pulse = cos(length(k) * 9.0 - t * 2.4);
                vec3 col = vec3(0.1, 0.7, 1.0) * (0.4 + 0.6 * wave);
                col += vec3(1.0, 0.3, 0.8) * (0.3 + 0.7 * pulse);
                col *= smoothstep(1.2, 0.0, length(p));
                gl_FragColor = vec4(col, 1.0);
            }
        `);
    }

    function createSineScroller() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050509);
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const scrollCanvas = document.createElement("canvas");
        scrollCanvas.width = 1024;
        scrollCanvas.height = 128;
        const ctx = scrollCanvas.getContext("2d");
        const texture = new THREE.CanvasTexture(scrollCanvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const message = "  AMIGA DEMOSCENE FOREVER · GREETINGS TO THE SCENE · KEEP CODING · ";
        ctx.font = "48px 'Trebuchet MS', sans-serif";
        const textWidth = ctx.measureText(message).width;
        let scroll = 0;

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uTexture: { value: texture },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: withSafePrecision(`
                varying vec2 vUv;
                uniform float uTime;
                uniform sampler2D uTexture;
                void main() {
                    float offset = sin(vUv.x * 10.0 + uTime * 3.5) * 0.08;
                    vec2 uv = vec2(vUv.x, clamp(vUv.y + offset, 0.0, 1.0));
                    vec4 tex = texture2D(uTexture, uv);
                    vec3 glow = tex.rgb + vec3(0.1, 0.4, 0.6) * tex.a;
                    gl_FragColor = vec4(glow, tex.a);
                }
            `),
            transparent: true,
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.6), material);
        mesh.position.y = 0.0;
        scene.add(mesh);

        const drawScroller = () => {
            ctx.clearRect(0, 0, scrollCanvas.width, scrollCanvas.height);
            ctx.fillStyle = "#050509";
            ctx.fillRect(0, 0, scrollCanvas.width, scrollCanvas.height);
            ctx.fillStyle = "#7cf9ff";
            ctx.shadowColor = "rgba(124, 249, 255, 0.8)";
            ctx.shadowBlur = 12;
            ctx.textBaseline = "middle";
            const y = scrollCanvas.height / 2 + 6;
            ctx.fillText(message, -scroll, y);
            ctx.fillText(message, -scroll + textWidth + 60, y);
            texture.needsUpdate = true;
        };

        drawScroller();

        return {
            scene,
            camera,
            update: (t, dt) => {
                material.uniforms.uTime.value = t;
                scroll = (scroll + dt * 120) % (textWidth + 60);
                drawScroller();
            },
        };
    }

    function createBobs() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050509);
        const camera = new THREE.OrthographicCamera(-10, 10, 7, -7, 0.1, 20);
        camera.position.z = 10;

        const spriteCanvas = document.createElement("canvas");
        spriteCanvas.width = 64;
        spriteCanvas.height = 64;
        const sctx = spriteCanvas.getContext("2d");
        const gradient = sctx.createRadialGradient(32, 32, 4, 32, 32, 30);
        gradient.addColorStop(0, "rgba(124, 249, 255, 1)");
        gradient.addColorStop(1, "rgba(124, 249, 255, 0)");
        sctx.fillStyle = gradient;
        sctx.fillRect(0, 0, 64, 64);
        const spriteTexture = new THREE.CanvasTexture(spriteCanvas);

        const count = 42;
        const positions = new Float32Array(count * 3);
        const phases = new Float32Array(count * 2);
        for (let i = 0; i < count; i += 1) {
            const i3 = i * 3;
            positions[i3] = 0;
            positions[i3 + 1] = 0;
            positions[i3 + 2] = 0;
            phases[i * 2] = Math.random() * Math.PI * 2;
            phases[i * 2 + 1] = Math.random() * Math.PI * 2;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            size: 1.6,
            map: spriteTexture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const points = new THREE.Points(geometry, material);
        scene.add(points);

        return {
            scene,
            camera,
            update: (t) => {
                const pos = geometry.attributes.position;
                for (let i = 0; i < count; i += 1) {
                    const phaseX = phases[i * 2];
                    const phaseY = phases[i * 2 + 1];
                    const x = Math.sin(t * 0.8 + phaseX) * 7.5 + Math.sin(t * 1.7 + phaseY) * 1.5;
                    const y = Math.cos(t * 1.1 + phaseY) * 4.0 + Math.sin(t * 0.6 + phaseX) * 1.2;
                    pos.setXYZ(i, x, y, 0);
                }
                pos.needsUpdate = true;
            },
            onResize: (w, h) => {
                const aspect = w / h;
                camera.left = -10 * aspect;
                camera.right = 10 * aspect;
                camera.updateProjectionMatrix();
            },
        };
    }

    function createFake3DFloor() {
        return createFullscreenEffect(`
            precision highp float;
            varying vec2 vUv;
            uniform float uTime;

            void main() {
                vec2 p = vUv * 2.0 - 1.0;
                if (p.y > 0.15) {
                    vec3 sky = mix(vec3(0.02, 0.02, 0.08), vec3(0.1, 0.2, 0.4), p.y * 0.5 + 0.5);
                    gl_FragColor = vec4(sky, 1.0);
                    return;
                }
                float denom = max(0.02, 0.15 - p.y);
                float z = 1.0 / denom;
                vec2 uv = vec2(p.x * z * 0.12, z * 0.08 + uTime * 0.6);
                float checker = step(0.5, fract(uv.x)) + step(0.5, fract(uv.y));
                checker = mod(checker, 2.0);
                vec3 colA = vec3(0.02, 0.1, 0.14);
                vec3 colB = vec3(0.15, 0.75, 0.6);
                vec3 floor = mix(colA, colB, checker);
                float fog = clamp(exp(-z * 0.03), 0.0, 1.0);
                floor = mix(vec3(0.0, 0.0, 0.02), floor, fog);
                gl_FragColor = vec4(floor, 1.0);
            }
        `);
    }

    function createChiptune(button, status) {
        let context = null;
        let master = null;
        let compressor = null;
        let isPlaying = false;
        let nextTime = 0;
        let step = 0;
        let rafId = null;
        let channels = [];
        let noiseBuffer = null;

        const bpm = 172;
        const stepsPerBeat = 4;
        const stepTime = 60 / bpm / stepsPerBeat;

        const notes = {
            C2: 65.41,
            D2: 73.42,
            E2: 82.41,
            G2: 98.0,
            A2: 110.0,
            C3: 130.81,
            D3: 146.83,
            E3: 164.81,
            F3: 174.61,
            G3: 196.0,
            A3: 220.0,
            B3: 246.94,
            C4: 261.63,
            D4: 293.66,
            E4: 329.63,
            F4: 349.23,
            G4: 392.0,
            A4: 440.0,
            B4: 493.88,
            C5: 523.25,
        };

        const bassPattern = [
            notes.C2, null, notes.C2, null,
            notes.G2, null, notes.A2, null,
            notes.C2, null, notes.C2, null,
            notes.E2, null, notes.G2, null,
        ];
        const leadPattern = [
            notes.C4, notes.D4, notes.E4, null,
            notes.G4, notes.A4, notes.C5, null,
            notes.E4, null, notes.D4, null,
            notes.C4, null, notes.A3, null,
        ];
        const arpPattern = [
            notes.C4, notes.E4, notes.G4, notes.E4,
            notes.D4, notes.F4, notes.A4, notes.F4,
            notes.E4, notes.G4, notes.B4, notes.G4,
            notes.D4, notes.F4, notes.A4, notes.F4,
        ];
        const kickPattern = [1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1];
        const snarePattern = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
        const hatPattern = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];

        function ensureContext() {
            if (context) return;
            context = new (window.AudioContext || window.webkitAudioContext)();
            master = context.createGain();
            master.gain.value = 0.28;

            compressor = context.createDynamicsCompressor();
            compressor.threshold.value = -18;
            compressor.knee.value = 24;
            compressor.ratio.value = 6;
            compressor.attack.value = 0.003;
            compressor.release.value = 0.18;

            master.connect(compressor).connect(context.destination);

            channels = [
                { type: "triangle", level: 0.1, pattern: bassPattern },
                { type: "square", level: 0.075, pattern: leadPattern },
                { type: "sawtooth", level: 0.05, pattern: arpPattern },
            ];

            channels.forEach((channel) => {
                const osc = context.createOscillator();
                const gainNode = context.createGain();
                osc.type = channel.type;
                gainNode.gain.value = 0.0;
                osc.connect(gainNode).connect(master);
                osc.start();
                channel.osc = osc;
                channel.gainNode = gainNode;
            });
        }

        function getNoiseBuffer() {
            if (noiseBuffer) return noiseBuffer;
            const duration = 0.5;
            noiseBuffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i += 1) {
                data[i] = Math.random() * 2 - 1;
            }
            return noiseBuffer;
        }

        function triggerKick(time) {
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(120, time);
            osc.frequency.exponentialRampToValueAtTime(44, time + 0.12);
            gain.gain.setValueAtTime(0.9, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
            osc.connect(gain).connect(master);
            osc.start(time);
            osc.stop(time + 0.14);
        }

        function triggerNoise(time, type, gainValue, duration, freq) {
            const source = context.createBufferSource();
            source.buffer = getNoiseBuffer();
            const filter = context.createBiquadFilter();
            filter.type = type;
            filter.frequency.setValueAtTime(freq, time);
            filter.Q.value = 0.8;
            const gain = context.createGain();
            gain.gain.setValueAtTime(gainValue, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
            source.connect(filter).connect(gain).connect(master);
            source.start(time);
            source.stop(time + duration);
        }

        function scheduleStep(time, index) {
            const accent = index % 4 === 0 ? 1.2 : 1.0;

            channels.forEach((channel) => {
                const note = channel.pattern[index % channel.pattern.length];
                const gainNode = channel.gainNode;
                gainNode.gain.cancelScheduledValues(time);
                if (note) {
                    channel.osc.frequency.setValueAtTime(note, time);
                    gainNode.gain.setValueAtTime(0.0, time);
                    gainNode.gain.linearRampToValueAtTime(channel.level * accent, time + 0.01);
                    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + stepTime * 0.85);
                } else {
                    gainNode.gain.setValueAtTime(0.0, time);
                }
            });

            if (kickPattern[index % kickPattern.length]) {
                triggerKick(time);
            }
            if (snarePattern[index % snarePattern.length]) {
                triggerNoise(time, "bandpass", 0.35, 0.12, 1800);
            }
            if (hatPattern[index % hatPattern.length]) {
                triggerNoise(time, "highpass", 0.12, 0.05, 6000);
            }
        }

        function scheduler() {
            const lookAhead = 0.12;
            while (nextTime < context.currentTime + lookAhead) {
                scheduleStep(nextTime, step);
                nextTime += stepTime;
                step = (step + 1) % 16;
            }
            rafId = requestAnimationFrame(scheduler);
        }

        function stopAll() {
            channels.forEach((channel) => {
                if (channel.gainNode) {
                    channel.gainNode.gain.setValueAtTime(0.0, context.currentTime);
                }
            });
        }

        function updateUI() {
            if (!button || !status) return;
            button.textContent = isPlaying ? "Chiptune: On" : "Chiptune: Off";
            status.textContent = isPlaying ? "Audio running (procedural WebAudio)." : "Audio off — click to enable.";
        }

        updateUI();

        return {
            toggle: async () => {
                ensureContext();
                if (!context) return;
                if (!isPlaying) {
                    await context.resume();
                    nextTime = context.currentTime + 0.05;
                    isPlaying = true;
                    scheduler();
                } else {
                    isPlaying = false;
                    if (rafId) cancelAnimationFrame(rafId);
                    stopAll();
                }
                updateUI();
            },
        };
    }
})();