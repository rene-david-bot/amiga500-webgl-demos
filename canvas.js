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
    const audioHint = document.querySelector(".audio-hint");
    const effectCode = document.getElementById("effect-code");

    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chip = createChiptune(audioBtn, audioStatus, audioHint);
    audioBtn?.addEventListener("click", chip.toggle);

    let currentIndex = 0;
    let currentEffect = null;
    let lastTime = 0;
    let cycleTimer = null;
    const size = { width: 0, height: 0 };

    const formatCode = (raw) => {
        if (!raw) return "";
        const lines = raw.replace(/\t/g, "  ").split("\n");
        let indent = 0;
        const out = [];
        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                out.push("");
                return;
            }
            if (/^[}\]]/.test(trimmed)) {
                indent = Math.max(indent - 1, 0);
            }
            out.push(`${"  ".repeat(indent)}${trimmed}`);
            if (/[{\[]$/.test(trimmed)) {
                indent += 1;
            }
        });
        return out.join("\n").trim();
    };

    const updateUI = (index) => {
        const effect = effects[index];
        stageTitle.textContent = effect.title;
        stageMeta.textContent = `${effect.category} · Classic Amiga effect`;
        stageDesc.textContent = effect.effect;
        stageLink.href = effect.url;
        stageIndex.textContent = `${index + 1} / ${effects.length}`;
        if (effectCode) {
            effectCode.textContent = formatCode(effect.factory?.toString());
        }
    };

    const setEffect = (index) => {
        currentIndex = index;
        updateUI(index);
        currentEffect = effects[index].factory();
        resize();
    };

    const resize = () => {
        const wrap = canvas.parentElement || canvas;
        const rect = wrap.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        size.width = rect.width;
        size.height = rect.height;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = true;
        if (currentEffect?.onResize) {
            currentEffect.onResize(size.width, size.height, dpr);
        }
    };

    const animate = (time) => {
        const t = time * 0.001;
        const dt = Math.min(t - lastTime, 0.05);
        lastTime = t;
        if (currentEffect?.update) {
            currentEffect.update(t, dt);
        }
        if (currentEffect?.draw) {
            currentEffect.draw(ctx, size.width, size.height, t, dt);
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

    function createLowRes(width, height, scale = 0.35) {
        const buffer = document.createElement("canvas");
        const bctx = buffer.getContext("2d", { willReadFrequently: true });
        let imageData = null;
        let data = null;

        const resize = (w, h) => {
            const bw = Math.max(90, Math.round(w * scale));
            const bh = Math.max(60, Math.round(h * scale));
            buffer.width = bw;
            buffer.height = bh;
            imageData = bctx.createImageData(bw, bh);
            data = imageData.data;
        };

        resize(width, height);

        return {
            canvas: buffer,
            ctx: bctx,
            resize,
            get imageData() {
                return imageData;
            },
            get data() {
                return data;
            },
            get width() {
                return buffer.width;
            },
            get height() {
                return buffer.height;
            },
        };
    }

    function createCopperBars() {
        return {
            draw: (ctx, w, h, t) => {
                ctx.fillStyle = "#050509";
                ctx.fillRect(0, 0, w, h);
                const barHeight = h * 0.12;
                for (let i = 0; i < 5; i += 1) {
                    const center =
                        h * 0.5 +
                        Math.sin(t * 0.8 + i * 1.4) * h * 0.22 +
                        (i - 2) * barHeight * 0.28;
                    const y = center - barHeight / 2;
                    const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
                    grad.addColorStop(0, "#1b0600");
                    grad.addColorStop(0.35, "#ff9f3f");
                    grad.addColorStop(0.5, "#fff0c7");
                    grad.addColorStop(0.65, "#ff6a00");
                    grad.addColorStop(1, "#1b0600");
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, y, w, barHeight);
                }
            },
        };
    }

    function createPlasma() {
        let low = createLowRes(320, 180, 0.32);
        const palette = new Array(256).fill(0).map((_, i) => {
            const v = i / 255;
            const r = Math.round(128 + 127 * Math.sin(v * Math.PI * 2 + 0));
            const g = Math.round(128 + 127 * Math.sin(v * Math.PI * 2 + 2));
            const b = Math.round(128 + 127 * Math.sin(v * Math.PI * 2 + 4));
            return [r, g, b];
        });

        return {
            onResize: (w, h) => {
                low.resize(w, h);
            },
            draw: (ctx, w, h, t) => {
                const lw = low.width;
                const lh = low.height;
                const data = low.data;
                let idx = 0;
                for (let y = 0; y < lh; y += 1) {
                    for (let x = 0; x < lw; x += 1) {
                        const dx = x - lw * 0.5;
                        const dy = y - lh * 0.5;
                        let v = 0;
                        v += Math.sin(x * 0.045 + t * 1.1);
                        v += Math.sin(y * 0.04 - t * 1.3);
                        v += Math.sin((x + y) * 0.03 + t * 0.9);
                        v += Math.sin(Math.sqrt(dx * dx + dy * dy) * 0.08 - t * 1.4);
                        v = (v + 4) * 0.125;
                        const color = palette[Math.floor(v * 255) & 255];
                        data[idx] = color[0];
                        data[idx + 1] = color[1];
                        data[idx + 2] = color[2];
                        data[idx + 3] = 255;
                        idx += 4;
                    }
                }
                low.ctx.putImageData(low.imageData, 0, 0);
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(low.canvas, 0, 0, w, h);
            },
        };
    }

    function createRotozoom() {
        const patternCanvas = document.createElement("canvas");
        patternCanvas.width = 160;
        patternCanvas.height = 160;
        const pctx = patternCanvas.getContext("2d");
        const cell = 20;
        for (let y = 0; y < patternCanvas.height; y += cell) {
            for (let x = 0; x < patternCanvas.width; x += cell) {
                const on = (x / cell + y / cell) % 2 === 0;
                pctx.fillStyle = on ? "#5ad7ff" : "#ff59d6";
                pctx.fillRect(x, y, cell, cell);
            }
        }
        pctx.strokeStyle = "rgba(0,0,0,0.25)";
        for (let i = 0; i <= patternCanvas.width; i += cell) {
            pctx.beginPath();
            pctx.moveTo(i, 0);
            pctx.lineTo(i, patternCanvas.height);
            pctx.stroke();
        }

        return {
            draw: (ctx, w, h, t) => {
                ctx.fillStyle = "#050509";
                ctx.fillRect(0, 0, w, h);
                ctx.save();
                ctx.translate(w / 2, h / 2);
                ctx.rotate(t * 0.45);
                const scale = 1.2 + 0.4 * Math.sin(t * 0.6);
                ctx.scale(scale, scale);
                const pattern = ctx.createPattern(patternCanvas, "repeat");
                ctx.fillStyle = pattern;
                ctx.fillRect(-w * 2, -h * 2, w * 4, h * 4);
                ctx.restore();
            },
        };
    }

    function createTunnel() {
        let low = createLowRes(320, 180, 0.35);
        return {
            onResize: (w, h) => {
                low.resize(w, h);
            },
            draw: (ctx, w, h, t) => {
                const lw = low.width;
                const lh = low.height;
                const data = low.data;
                let idx = 0;
                for (let y = 0; y < lh; y += 1) {
                    for (let x = 0; x < lw; x += 1) {
                        const dx = (x - lw * 0.5) / lw;
                        const dy = (y - lh * 0.5) / lh;
                        const r = Math.sqrt(dx * dx + dy * dy);
                        const angle = Math.atan2(dy, dx);
                        const u = angle / (Math.PI * 2) + 0.5 + t * 0.05;
                        const v = 1.0 / (r + 0.22) + t * 0.9;
                        const stripes = 0.5 + 0.5 * Math.sin(v * 6.0);
                        const rings = 0.5 + 0.5 * Math.cos(v * 3.0 + u * 6.0);
                        const base = Math.max(0, 1 - r * 1.4);
                        const rcol = 30 + 190 * stripes * base;
                        const gcol = 40 + 140 * rings * base;
                        const bcol = 90 + 160 * (1 - stripes) * base;
                        data[idx] = rcol;
                        data[idx + 1] = gcol;
                        data[idx + 2] = bcol;
                        data[idx + 3] = 255;
                        idx += 4;
                    }
                }
                low.ctx.putImageData(low.imageData, 0, 0);
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(low.canvas, 0, 0, w, h);
            },
        };
    }

    function createStarfield() {
        const count = 420;
        let stars = [];
        let width = 0;
        let height = 0;

        const resetStar = (star) => {
            star.x = (Math.random() - 0.5) * width;
            star.y = (Math.random() - 0.5) * height;
            star.z = Math.random() * 1 + 0.2;
            star.speed = 0.3 + Math.random() * 0.7;
        };

        return {
            onResize: (w, h) => {
                width = w;
                height = h;
                stars = Array.from({ length: count }, () => {
                    const star = {};
                    resetStar(star);
                    return star;
                });
            },
            update: (t, dt) => {
                stars.forEach((star) => {
                    star.z -= dt * star.speed;
                    if (star.z <= 0.15) {
                        resetStar(star);
                    }
                });
            },
            draw: (ctx, w, h) => {
                ctx.fillStyle = "#050509";
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = "#dff9ff";
                stars.forEach((star) => {
                    const sx = star.x / star.z + w / 2;
                    const sy = star.y / star.z + h / 2;
                    if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) return;
                    const size = Math.max(1, (1 / star.z) * 1.2);
                    ctx.globalAlpha = Math.min(1, 0.4 + (1 - star.z) * 0.8);
                    ctx.fillRect(sx, sy, size, size);
                });
                ctx.globalAlpha = 1;
            },
        };
    }

    function createMetaballs() {
        let low = createLowRes(320, 180, 0.3);
        const balls = Array.from({ length: 6 }, () => ({ x: 0, y: 0, r: 0 }));

        return {
            onResize: (w, h) => {
                low.resize(w, h);
            },
            update: (t) => {
                balls.forEach((ball, i) => {
                    const speed = 0.7 + i * 0.1;
                    ball.x = 0.5 + 0.28 * Math.sin(t * speed + i * 1.1);
                    ball.y = 0.5 + 0.25 * Math.cos(t * speed * 0.9 + i * 1.3);
                    ball.r = 0.09 + 0.03 * Math.sin(t * 0.7 + i);
                });
            },
            draw: (ctx, w, h) => {
                const lw = low.width;
                const lh = low.height;
                const data = low.data;
                let idx = 0;
                for (let y = 0; y < lh; y += 1) {
                    for (let x = 0; x < lw; x += 1) {
                        const ux = x / lw;
                        const uy = y / lh;
                        let field = 0;
                        balls.forEach((ball) => {
                            const dx = ux - ball.x;
                            const dy = uy - ball.y;
                            const d = dx * dx + dy * dy + 0.0008;
                            field += (ball.r * ball.r) / d;
                        });
                        const glow = Math.min(1, field * 0.8);
                        const rcol = 20 + glow * 220;
                        const gcol = 40 + glow * 120;
                        const bcol = 120 + glow * 140;
                        data[idx] = rcol;
                        data[idx + 1] = gcol;
                        data[idx + 2] = bcol;
                        data[idx + 3] = 255;
                        idx += 4;
                    }
                }
                low.ctx.putImageData(low.imageData, 0, 0);
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(low.canvas, 0, 0, w, h);
            },
        };
    }

    function createKaleidoscope() {
        let low = createLowRes(320, 180, 0.32);
        const sides = 8;
        const slice = (Math.PI * 2) / sides;

        return {
            onResize: (w, h) => {
                low.resize(w, h);
            },
            draw: (ctx, w, h, t) => {
                const lw = low.width;
                const lh = low.height;
                const data = low.data;
                let idx = 0;
                for (let y = 0; y < lh; y += 1) {
                    for (let x = 0; x < lw; x += 1) {
                        const px = (x / lw) * 2 - 1;
                        const py = (y / lh) * 2 - 1;
                        const r = Math.sqrt(px * px + py * py);
                        let a = Math.atan2(py, px);
                        a = ((a % slice) + slice) % slice;
                        a = Math.abs(a - slice * 0.5);
                        const kx = Math.cos(a) * r;
                        const ky = Math.sin(a) * r;
                        const wave = Math.sin((kx + ky) * 6 + t * 1.4);
                        const pulse = Math.cos(r * 10 - t * 2.1);
                        const rcol = 40 + 160 * (0.5 + 0.5 * wave);
                        const gcol = 40 + 160 * (0.5 + 0.5 * pulse);
                        const bcol = 90 + 140 * (0.5 + 0.5 * wave);
                        data[idx] = rcol;
                        data[idx + 1] = gcol;
                        data[idx + 2] = bcol;
                        data[idx + 3] = 255;
                        idx += 4;
                    }
                }
                low.ctx.putImageData(low.imageData, 0, 0);
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(low.canvas, 0, 0, w, h);
            },
        };
    }

    function createSineScroller() {
        const scrollCanvas = document.createElement("canvas");
        scrollCanvas.width = 2000;
        scrollCanvas.height = 90;
        const sctx = scrollCanvas.getContext("2d");
        const message = "  AMIGA DEMOSCENE FOREVER · GREETINGS TO THE SCENE · KEEP CODING · ";
        let scroll = 0;
        const textHeight = 60;

        const redrawText = () => {
            sctx.clearRect(0, 0, scrollCanvas.width, scrollCanvas.height);
            sctx.fillStyle = "#050509";
            sctx.fillRect(0, 0, scrollCanvas.width, scrollCanvas.height);
            sctx.font = "bold 54px 'VT323', monospace";
            sctx.textBaseline = "middle";
            sctx.fillStyle = "#6bffea";
            sctx.shadowColor = "rgba(107, 255, 234, 0.7)";
            sctx.shadowBlur = 10;
            sctx.fillText(message, 20, scrollCanvas.height / 2 + 6);
        };

        redrawText();

        return {
            update: (t, dt) => {
                scroll = (scroll + dt * 140) % scrollCanvas.width;
            },
            draw: (ctx, w, h, t) => {
                ctx.fillStyle = "#050509";
                ctx.fillRect(0, 0, w, h);
                const baseY = h * 0.55;
                const slice = 3;
                for (let x = 0; x < w; x += slice) {
                    const offset = Math.sin(x * 0.03 + t * 3) * 18;
                    ctx.drawImage(
                        scrollCanvas,
                        (scroll + x) % scrollCanvas.width,
                        scrollCanvas.height / 2 - textHeight / 2,
                        slice,
                        textHeight,
                        x,
                        baseY + offset,
                        slice,
                        textHeight
                    );
                }
            },
        };
    }

    function createBobs() {
        const sprite = document.createElement("canvas");
        sprite.width = 64;
        sprite.height = 64;
        const sctx = sprite.getContext("2d");
        const grad = sctx.createRadialGradient(32, 32, 4, 32, 32, 30);
        grad.addColorStop(0, "rgba(124, 249, 255, 1)");
        grad.addColorStop(1, "rgba(124, 249, 255, 0)");
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, 64, 64);

        const count = 36;
        const phases = Array.from({ length: count }, () => [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2]);

        return {
            draw: (ctx, w, h, t) => {
                ctx.fillStyle = "#050509";
                ctx.fillRect(0, 0, w, h);
                ctx.globalCompositeOperation = "lighter";
                phases.forEach(([p1, p2]) => {
                    const x = w / 2 + Math.sin(t * 0.9 + p1) * w * 0.35 + Math.sin(t * 1.8 + p2) * w * 0.08;
                    const y = h / 2 + Math.cos(t * 1.1 + p2) * h * 0.25 + Math.sin(t * 0.6 + p1) * h * 0.08;
                    ctx.drawImage(sprite, x - 32, y - 32, 64, 64);
                });
                ctx.globalCompositeOperation = "source-over";
            },
        };
    }

function createFake3DFloor() {
    return {
        draw: (ctx, w, h, t) => {
            const horizon = h * 0.35;
            const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
            skyGrad.addColorStop(0, "#080814");
            skyGrad.addColorStop(1, "#121a2e");
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, w, horizon);

            ctx.fillStyle = "#050509";
            ctx.fillRect(0, horizon, w, h - horizon);

            const rows = 26;
            const cols = 20;
            const offset = (t * 0.35) % 1;
            const dark = "#0a0a14";
            const light = "#2b5bff";

            for (let r = 0; r < rows; r += 1) {
                let p0 = r / rows + offset;
                let p1 = (r + 1) / rows + offset;
                if (p0 > 1) p0 -= 1;
                if (p1 > 1) p1 -= 1;
                if (p1 <= p0) continue;

                const y0 = horizon + (p0 * p0) * (h - horizon);
                const y1 = horizon + (p1 * p1) * (h - horizon);

                const scale0 = 0.18 + p0 * 0.92;
                const scale1 = 0.18 + p1 * 0.92;
                const half0 = (w * 0.5) * scale0;
                const half1 = (w * 0.5) * scale1;

                for (let c = -cols / 2; c < cols / 2; c += 1) {
                    const x0 = w / 2 + (c / (cols / 2)) * half0;
                    const x1 = w / 2 + ((c + 1) / (cols / 2)) * half0;
                    const x2 = w / 2 + ((c + 1) / (cols / 2)) * half1;
                    const x3 = w / 2 + (c / (cols / 2)) * half1;

                    const parity = (r + c) & 1;
                    ctx.fillStyle = parity === 0 ? dark : light;
                    ctx.beginPath();
                    ctx.moveTo(x0, y0);
                    ctx.lineTo(x1, y0);
                    ctx.lineTo(x2, y1);
                    ctx.lineTo(x3, y1);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        },
    };
}

    function createChiptune(button, status, hint) {
        let context = null;
        let master = null;
        let compressor = null;
        let isPlaying = false;
        let nextTime = 0;
        let step = 0;
        let rafId = null;
        let channels = [];
        let noiseBuffer = null;
        let autoplayBlocked = false;
        let desiredOn = false;
    
        const bpm = 140;
        const stepsPerBeat = 4;
        const stepTime = 60 / bpm / stepsPerBeat;
    
        const notes = {
            A1: 55.0,
            B1: 61.74,
            C2: 65.41,
            D2: 73.42,
            E2: 82.41,
            F2: 87.31,
            G2: 98.0,
            A2: 110.0,
            B2: 123.47,
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
            D5: 587.33,
            E5: 659.25,
            G5: 783.99,
        };
    
        const bassPattern = [
            notes.A2, null, null, null, notes.A2, null, notes.A2, null,
            notes.A2, null, notes.E2, null, notes.G2, null, notes.E2, null,
            notes.F2, null, null, null, notes.F2, null, notes.C2, null,
            notes.F2, null, notes.A2, null, notes.C3, null, notes.A2, null,
            notes.C2, null, null, null, notes.C2, null, notes.G2, null,
            notes.C2, null, notes.E2, null, notes.G2, null, notes.E2, null,
            notes.G2, null, null, null, notes.G2, null, notes.D2, null,
            notes.G2, null, notes.B2, null, notes.D3, null, notes.B2, null,
        ];
    
        const leadPattern = [
            notes.A4, null, notes.C5, null, notes.E5, null, notes.C5, null,
            notes.G4, null, notes.A4, null, notes.C5, null, notes.B4, null,
            notes.A4, null, notes.C5, null, notes.E5, null, notes.D5, null,
            notes.C5, null, notes.B4, null, notes.A4, null, notes.G4, null,
            notes.C5, null, notes.E5, null, notes.G5, null, notes.E5, null,
            notes.D5, null, notes.C5, null, notes.B4, null, notes.A4, null,
            notes.G4, null, notes.A4, null, notes.B4, null, notes.C5, null,
            notes.E5, null, notes.D5, null, notes.C5, null, notes.A4, null,
        ];
    
        const arpPattern = [
            notes.A3, notes.C4, notes.E4, notes.C4,
            notes.A3, notes.C4, notes.E4, notes.C4,
            notes.A3, notes.C4, notes.E4, notes.C4,
            notes.A3, notes.C4, notes.E4, notes.C4,
            notes.F3, notes.A3, notes.C4, notes.A3,
            notes.F3, notes.A3, notes.C4, notes.A3,
            notes.F3, notes.A3, notes.C4, notes.A3,
            notes.F3, notes.A3, notes.C4, notes.A3,
            notes.C4, notes.E4, notes.G4, notes.E4,
            notes.C4, notes.E4, notes.G4, notes.E4,
            notes.C4, notes.E4, notes.G4, notes.E4,
            notes.C4, notes.E4, notes.G4, notes.E4,
            notes.G3, notes.B3, notes.D4, notes.B3,
            notes.G3, notes.B3, notes.D4, notes.B3,
            notes.G3, notes.B3, notes.D4, notes.B3,
            notes.G3, notes.B3, notes.D4, notes.B3,
        ];
    
        const kickPattern = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
        const snarePattern = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
        const hatPattern = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
    
        function ensureContext() {
            if (context) return;
            context = new (window.AudioContext || window.webkitAudioContext)();
            master = context.createGain();
            master.gain.value = 0.24;
    
            compressor = context.createDynamicsCompressor();
            compressor.threshold.value = -18;
            compressor.knee.value = 22;
            compressor.ratio.value = 5;
            compressor.attack.value = 0.004;
            compressor.release.value = 0.2;
    
            master.connect(compressor).connect(context.destination);
    
            channels = [
                { type: "triangle", level: 0.13, pattern: bassPattern },
                { type: "square", level: 0.09, pattern: leadPattern, detune: 6 },
                { type: "square", level: 0.06, pattern: arpPattern, detune: -6 },
            ];
    
            channels.forEach((channel) => {
                const osc = context.createOscillator();
                const gainNode = context.createGain();
                osc.type = channel.type;
                if (channel.detune) {
                    osc.detune.value = channel.detune;
                }
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
            osc.frequency.setValueAtTime(130, time);
            osc.frequency.exponentialRampToValueAtTime(46, time + 0.14);
            gain.gain.setValueAtTime(0.9, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
            osc.connect(gain).connect(master);
            osc.start(time);
            osc.stop(time + 0.16);
        }
    
        function triggerNoise(time, type, gainValue, duration, freq) {
            const source = context.createBufferSource();
            source.buffer = getNoiseBuffer();
            const filter = context.createBiquadFilter();
            filter.type = type;
            filter.frequency.setValueAtTime(freq, time);
            filter.Q.value = 0.9;
            const gain = context.createGain();
            gain.gain.setValueAtTime(gainValue, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
            source.connect(filter).connect(gain).connect(master);
            source.start(time);
            source.stop(time + duration);
        }
    
        function scheduleStep(time, index) {
            const accent = index % 16 === 0 ? 1.25 : 1.0;
    
            channels.forEach((channel) => {
                const note = channel.pattern[index % channel.pattern.length];
                const gainNode = channel.gainNode;
                gainNode.gain.cancelScheduledValues(time);
                if (note) {
                    channel.osc.frequency.setValueAtTime(note, time);
                    gainNode.gain.setValueAtTime(0.0, time);
                    gainNode.gain.linearRampToValueAtTime(channel.level * accent, time + 0.01);
                    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + stepTime * 0.9);
                } else {
                    gainNode.gain.setValueAtTime(0.0, time);
                }
            });
    
            if (kickPattern[index % kickPattern.length]) {
                triggerKick(time);
            }
            if (snarePattern[index % snarePattern.length]) {
                triggerNoise(time, "bandpass", 0.35, 0.14, 1800);
            }
            if (hatPattern[index % hatPattern.length]) {
                triggerNoise(time, "highpass", 0.12, 0.05, 7000);
            }
        }
    
        function scheduler() {
            const lookAhead = 0.12;
            while (nextTime < context.currentTime + lookAhead) {
                scheduleStep(nextTime, step);
                nextTime += stepTime;
                step = (step + 1) % 64;
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
            button.textContent = desiredOn ? "Chiptune: On" : "Chiptune: Off";
            if (hint) {
                hint.classList.toggle("is-hidden", isPlaying);
            }
            if (isPlaying) {
                status.textContent = "Audio running — 140 BPM chiptune.";
            } else if (autoplayBlocked) {
                status.textContent = "Autoplay blocked by browser — click to enable audio.";
            } else if (desiredOn) {
                status.textContent = "Starting audio...";
            } else {
                status.textContent = "Audio off — click to enable.";
            }
        }
    
        async function startAudio(fromUser = false) {
            ensureContext();
            if (!context) return false;
            try {
                await context.resume();
            } catch (err) {
                autoplayBlocked = !fromUser;
                isPlaying = false;
                updateUI();
                return false;
            }
            autoplayBlocked = false;
            if (!isPlaying) {
                nextTime = context.currentTime + 0.05;
                isPlaying = true;
                scheduler();
            }
            updateUI();
            return true;
        }
    
        function stopAudio() {
            isPlaying = false;
            if (rafId) cancelAnimationFrame(rafId);
            stopAll();
            updateUI();
        }
    
        updateUI();
    
        return {
            toggle: async () => {
                if (desiredOn) {
                    desiredOn = false;
                    stopAudio();
                } else {
                    desiredOn = true;
                    await startAudio(true);
                }
            },
            autoplay: async () => {
                desiredOn = true;
                updateUI();
                await startAudio(false);
            },
        };
    }
})();
