// ================== GAME STATE ==================
let gameState = "INTRO"; // INTRO | READY | PLAYING | GAMEOVER
let palmStartTime = null;
let gameStarted = false;

let objects = [];
let score = 0;
let fingerInsideOK = false;
let instructionLocked = false;
let strikes = 0;
const MAX_STRIKES = 3;
let lastFrameTime = performance.now();

function isHandClosed() {
    if (!handLandmarks) return false;

    // Tip indices (MediaPipe)
    const tips = [8, 12, 16, 20]; // index, middle, ring, pinky
    const base = 0; // wrist

    let closedCount = 0;

    for (let tip of tips) {
        const dx = handLandmarks[tip].x - handLandmarks[base].x;
        const dy = handLandmarks[tip].y - handLandmarks[base].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.15) closedCount++; // fingers close to palm
    }

    return closedCount >= 3; // mostly closed
}

let difficulty = {
    spawnInterval: 900,
    speedMultiplier: 1,
    sizeMultiplier: 1,
    dangerChance: 0.07
};
let spawnInterval = null;

const sounds = {
    slice: new Audio("sounds/slice.mp3"),
    danger: new Audio("sounds/danger.mp3"),
    miss: new Audio("sounds/miss.mp3"),
    gameover: new Audio("sounds/gameover.mp3")
};

// Important for rapid replay
Object.values(sounds).forEach(s => {
    s.preload = "auto";
    s.volume = 0.6;
});

let restartHoldStart = null;


const NEON_COLORS = [
    "#00FFFF",
    "#FF2FD5",
    "#7CFF00",
    "#7B5CFF",
    "#00AFFF"
];


// Instruction modal state
let instructionsOpen = true;
let lastTapTime = 0;
let tapCount = 0;
let lastInstructionCheck = 0;
let okHoverStartTime = null;


// ================== CANVAS ==================
let canvas, ctx;
let trail = [];

// ================== ON LOAD ==================
window.onload = () => {
    const video = document.getElementById("camera");
    const fingerCursor = document.getElementById("finger-cursor");
    const statusText = document.getElementById("status");

    // ================== CAMERA ==================
    let instructionFrameSkip = 0;

    const camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
            updateFingerCursor();
        },
        width: 640,
        height: 480
    });

    camera.start();

    spawnInterval = setInterval(() => {
        if (gameState === "PLAYING") {
            spawnObject();

            // difficulty burst
            if (Math.random() > 0.5) spawnObject();
        }
    }, 900);

    const bgIdle = document.getElementById("bgIdle");
bgIdle.volume = 0.15; // 🔉 very soft, voice-friendly
bgIdle.loop = true;

let idleStarted = false;

function tryStartIdle() {
  if (!idleStarted && handDetected) {
    bgIdle.play().catch(() => {});
    idleStarted = true;
  }
}



    function animateTrail() {

        const now = performance.now();
        const delta = (now - lastFrameTime) / 16.67; // normalize to 60fps
        lastFrameTime = now;

        ctx.clearRect(0, 0, canvas.width, canvas.height);


        if (gameState === "GAMEOVER") return;

        // 🔷 DRAW OBJECTS
        for (const obj of objects) {
            if (!obj.alive) continue;

            ctx.globalAlpha = 0.35;
            ctx.fillStyle = obj.color;
            ctx.beginPath();

            if (obj.type === "ORB" || obj.type === "DANGER") {
                ctx.arc(obj.x, obj.y, obj.r + 6, 0, Math.PI * 2);
            } else if (obj.type === "BLOCK") {
                ctx.rect(
                    obj.x - obj.r - 6,
                    obj.y - obj.r - 6,
                    (obj.r + 6) * 2,
                    (obj.r + 6) * 2
                );
            } else {
                ctx.moveTo(obj.x, obj.y - obj.r - 6);
                ctx.lineTo(obj.x - obj.r - 6, obj.y + obj.r + 6);
                ctx.lineTo(obj.x + obj.r + 6, obj.y + obj.r + 6);
                ctx.closePath();
            }

            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // 🔷 SLASH TRAIL
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (let i = 0; i < trail.length - 1; i++) {
            const p1 = trail[i];
            const p2 = trail[i + 1];

            ctx.strokeStyle = `rgba(0,255,255,${p1.life})`;
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            p1.life -= 0.18;
        }

        trail = trail.filter(p => p.life > 0);

        if (gameState === "PLAYING") {
            updateObjects(delta);
            checkCollisions();
        }

        requestAnimationFrame(animateTrail);
    }

    // ================== CANVAS ==================
    canvas = document.getElementById("slashCanvas");
    ctx = canvas.getContext("2d");

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    animateTrail();

    // ================== UPDATE CURSOR ==================
    function updateFingerCursor() {
        tryStartIdle();
        if (!handDetected || !indexFinger) {
            fingerCursor.style.display = "none";
            return;
        }

        fingerCursor.style.display = "block";

        const x = indexFinger.x * window.innerWidth;
        const y = indexFinger.y * window.innerHeight;

        fingerCursor.style.left = `${x}px`;
        fingerCursor.style.top = `${y}px`;

        // 🔒 Block game logic while instructions are open
        if (instructionsOpen) {
            handleInstructionTap(x, y);
            return;
        }


        if (gameState === "INTRO") {
            statusText.style.display = "block";
            handlePalmToStart();
        }

        if (gameState === "READY") {
            statusText.textContent = "READY ✊ FIST TO START";
            if (currentGesture === "FIST") startGame();
        }

        if (gameState === "PLAYING" && currentGesture === "POINT") {
            addTrailPoint();
        }

        // 🔁 RESTART FROM GAME OVER
        // 🔁 GAME OVER — HOLD FIST TO RESTART
        if (gameState === "GAMEOVER") {
            statusText.style.display = "block";
            statusText.textContent = "✊ HOLD FIST TO RESTART";

            const ringSvg = document.getElementById("tap-ring");
            const ring = ringSvg?.querySelector("circle");

            if (currentGesture === "FIST" || isHandClosed()) {

                if (!restartHoldStart) {
                    restartHoldStart = Date.now();
                    ringSvg.style.opacity = "1";
                }

                const elapsed = Date.now() - restartHoldStart;
                const progress = Math.min(elapsed / 1500, 1); // ⏱ 1.5 sec

                if (ring) {
                    ring.style.strokeDashoffset = 214 - progress * 214;
                }

                if (progress >= 1) {
                    location.reload(); // 🔥 clean restart
                }

            } else {
                // ❌ Fist released → reset loader
                restartHoldStart = null;
                if (ringSvg) ringSvg.style.opacity = "0";
                if (ring) ring.style.strokeDashoffset = 214;
            }

            return;
        }

    }


    // ================== INTRO → READY ==================
    function handlePalmToStart() {
        if (currentGesture === "PALM") {
            if (!palmStartTime) palmStartTime = Date.now();

            const held = Date.now() - palmStartTime;
            statusText.textContent = `HOLD PALM ${Math.min(100, Math.floor(held / 12))}%`;

            if (held > 1200) startGameReady();
        } else {
            palmStartTime = null;
        }
    }

    function startGameReady() {
        gameState = "READY";
        const intro = document.getElementById("intro");
        intro.style.opacity = "0";

        setTimeout(() => {
            intro.style.display = "none";
            statusText.textContent = "READY ✊ FIST TO START";
        }, 850);
    }

    // ================== START GAME ==================
    function startGame() {
        const startSound = document.getElementById("startSound");
startSound.volume = 0.6;
startSound.currentTime = 0;
startSound.play().catch(() => {});

        if (gameStarted) return;

        gameStarted = true;
        gameState = "PLAYING";

        document.getElementById("score").style.display = "block";
        statusText.style.display = "none";

        const impact = document.getElementById("impact");
        impact.classList.add("active");
        setTimeout(() => impact.classList.remove("active"), 200);

        startSpawner(); // ✅ HERE

        console.log("🎮 NEON BREAKER — GAME STARTED");
    }

    // ================== SLASH TRAIL ==================
    let lastX = null, lastY = null;

    function addTrailPoint() {
        const x = indexFinger.x * canvas.width;
        const y = indexFinger.y * canvas.height;

        if (lastX !== null) {
            const dx = x - lastX;
            const dy = y - lastY;
            if (Math.sqrt(dx * dx + dy * dy) < 6) return;
        }

        lastX = x;
        lastY = y;

        trail.push({ x, y, life: 1 });
        if (trail.length > 8) trail.shift();
    }

    // ================== DRAW LOOP ==================
    function updateObjects(delta) {
        for (const obj of objects) {
            if (!obj.alive) continue;

            obj.x += obj.vx * delta;
            obj.y += obj.vy * delta;
        }

        objects = objects.filter(o =>
            o.x > -200 &&
            o.x < canvas.width + 200 &&
            o.y > -200 &&
            o.y < canvas.height + 200 &&
            o.alive
        );
    }



    // ================== OBJECTS ==================
    function spawnObject() {
        const sideRand = Math.random();
        let side = "TOP";

        if (sideRand < 0.25) side = "TOP";
        else if (sideRand < 0.5) side = "BOTTOM";
        else if (sideRand < 0.75) side = "LEFT";
        else side = "RIGHT";

        const speed = 1.8 + Math.random() * 0.8;

        let x, y, vx = 0, vy = 0;

        switch (side) {
            case "TOP":
                x = Math.random() * canvas.width;
                y = -60;
                vx = (Math.random() - 0.5) * 0.6;
                vy = speed;
                break;

            case "BOTTOM":
                x = Math.random() * canvas.width;
                y = canvas.height + 60;
                vx = (Math.random() - 0.5) * 0.6;
                vy = -speed;
                break;

            case "LEFT":
                x = -60;
                y = Math.random() * canvas.height;
                vx = speed;
                vy = (Math.random() - 0.5) * 0.6;
                break;

            case "RIGHT":
                x = canvas.width + 60;
                y = Math.random() * canvas.height;
                vx = -speed;
                vy = (Math.random() - 0.5) * 0.6;
                break;
        }

        // ---------- TYPE & DIFFICULTY SCALING ----------
        let dangerChance = 0.07; // base 7%

        if (score > 200) dangerChance = 0.12;
        if (score > 500) dangerChance = 0.18;
        if (score > 800) dangerChance = 0.25;

        const rType = Math.random();
        let type;

        if (rType < difficulty.dangerChance) type = "DANGER";
        else if (rType < 0.45) type = "ORB";
        else if (rType < 0.7) type = "SHARD";
        else type = "BLOCK";



        let color;
        let radius;

        if (type === "DANGER") {
            color = "#FF0033";        // BLOOD RED
            radius = 46;              // Bigger than others
        } else {
            color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
            radius = type === "BLOCK" ? 44 : type === "ORB" ? 36 : 30;
        }

        objects.push({
            type,
            color,
            x,
            y,
            r: (
                type === "BLOCK" ? 44 :
                    type === "ORB" ? 36 : 30
            ) * difficulty.sizeMultiplier,
            vx,
            vy,
            alive: true
        });

    }


    function updateObjects() {
        for (const obj of objects) {
            if (!obj.alive) continue;

            obj.x += obj.vx;
            obj.y += obj.vy;
        }

        objects = objects.filter(o =>
            o.x > -200 &&
            o.x < canvas.width + 200 &&
            o.y > -200 &&
            o.y < canvas.height + 200 &&
            o.alive
        );
    }



    function checkCollisions() {
        if (trail.length < 2) return;

        const p = trail[trail.length - 1];

        for (const obj of objects) {
            if (!obj.alive) continue;

            const dx = obj.x - p.x;
            const dy = obj.y - p.y;

            if (Math.sqrt(dx * dx + dy * dy) < obj.r + 25) {

                // ⚠️ Danger slice
                if (obj.type === "DANGER") {
                    obj.alive = false;
                    addStrike();
                    playSound("danger");
                    flashScreen("red");
                    flashEdge("rgba(255,0,40,0.9)");
                    showWarningText();
                    shakeScreen(8);
                    return;
                }

                // ✅ Normal slice
                obj.alive = false;
                score += obj.type === "BLOCK" ? 20 : obj.type === "SHARD" ? 15 : 10;
                document.getElementById("score").textContent = `SCORE: ${score}`;
                playSound("slice");
                flashEdge(obj.color); // 👈 NEON COLOR EDGE
                updateDifficulty();

                if (obj.type === "BLOCK") shakeScreen(6);

                // ✨ Sparkle particles
                for (let i = 0; i < 6; i++) {
                    trail.push({
                        x: p.x + Math.random() * 20 - 10,
                        y: p.y + Math.random() * 20 - 10,
                        life: 0.6
                    });
                }

            }
        }
    }

    let spawnTimer = 900;

    setInterval(() => {
        if (gameState !== "PLAYING") return;

        let count = 1;

        if (score > 100) count = 2;
        if (score > 300) count = 3;
        if (score > 600) count = 4;
        if (score > 900) count = 5;

        for (let i = 0; i < count; i++) {
            spawnObject();
        }
    }, spawnTimer);

    // ================== INSTRUCTION TAP ==================
    function handleInstructionTap(fx, fy) {
        if (instructionLocked) return;

        const ok = document.getElementById("gesture-ok");
        if (!ok) return;

        const rect = ok.getBoundingClientRect();

        const inside =
            fx > rect.left &&
            fx < rect.right &&
            fy > rect.top &&
            fy < rect.bottom;

        // Highlight when hovering
        ok.style.boxShadow = inside
            ? "0 0 25px rgba(0,255,255,1)"
            : "0 0 18px rgba(0,255,255,0.6)";

        const percentText = document.getElementById("hold-percent");
        const ring = document.getElementById("tap-ring")?.querySelector("circle");

        if (!inside) {
            okHoverStartTime = null;

            document.getElementById("tap-ring").style.opacity = "0";

            if (percentText) percentText.textContent = "0%";
            if (ring) ring.style.strokeDashoffset = "214";
            return;
        }


        if (!okHoverStartTime) {
            okHoverStartTime = Date.now();
            document.getElementById("tap-ring").style.opacity = "1";
        }

        const elapsed = Date.now() - okHoverStartTime;
        const progress = Math.min(100, Math.floor((elapsed / 2000) * 100));

        if (percentText) percentText.textContent = `${progress}%`;

        if (ring) {
            // 214 is full circumference (approx for r=34)
            const offset = 214 - (214 * progress / 100);
            ring.style.strokeDashoffset = offset;
        }

        if (elapsed > 2000) {
            instructionLocked = true;
            closeInstructions();
        }
    }

    function closeInstructions() {
        instructionsOpen = false;
        instructionLocked = true;
        tapCount = 0;

        document.getElementById("instructions-overlay").style.display = "none";
    }
    function addStrike() {
        strikes++;
        console.log("Strike:", strikes);
        playSound("miss");

        if (strikes >= MAX_STRIKES) {
            gameOver();
        }
    }

    function gameOver() {
        gameState = "GAMEOVER";

        // 🛑 stop spawning
        if (spawnInterval) {
            clearInterval(spawnInterval);
            spawnInterval = null;
        }

        // 🛑 freeze gameplay visuals
        objects = [];
        trail = [];

        showGameOverPopup();
    }



    function flashScreen(color) {
        const impact = document.getElementById("impact");
        impact.style.background =
            color === "red"
                ? "radial-gradient(circle, rgba(255,0,50,0.6), transparent 70%)"
                : "";

        impact.classList.add("active");
        setTimeout(() => impact.classList.remove("active"), 200);
    }

    function showWarningText() {
        const container = document.getElementById("warning-container");
        if (!container) return;

        const text = document.createElement("div");
        text.className = "warning-text";

        const left = MAX_STRIKES - strikes;

        text.innerHTML =
            left > 0
                ? `⚠️ WARNING<br>${left} STRIKE${left === 1 ? "" : "S"} LEFT`
                : `💀 FINAL STRIKE`;

        container.appendChild(text);

        setTimeout(() => {
            text.remove();
        }, 1000);
    }

    function flashEdge(color) {
        const edge = document.getElementById("edge-flash");
        if (!edge) return;

        edge.style.setProperty("--edge-color", color);
        edge.classList.remove("active"); // reset
        void edge.offsetWidth;           // force reflow
        edge.classList.add("active");
    }

    function updateDifficulty() {
        if (score >= 100) {
            difficulty.spawnInterval = 750;
            difficulty.speedMultiplier = 1.15;
            difficulty.sizeMultiplier = 0.95;
            difficulty.dangerChance = 0.1;
        }

        if (score >= 300) {
            difficulty.spawnInterval = 600;
            difficulty.speedMultiplier = 1.35;
            difficulty.sizeMultiplier = 0.9;
            difficulty.dangerChance = 0.14;
        }

        if (score >= 600) {
            difficulty.spawnInterval = 450;
            difficulty.speedMultiplier = 1.6;
            difficulty.sizeMultiplier = 0.85;
            difficulty.dangerChance = 0.18;
        }

        if (score >= 1000) {
            difficulty.spawnInterval = 320;
            difficulty.speedMultiplier = 1.9;
            difficulty.sizeMultiplier = 0.8;
            difficulty.dangerChance = 0.25;
        }
        startSpawner();
    }

    function startSpawner() {
        if (spawnTimer) clearInterval(spawnTimer);

        spawnTimer = setInterval(() => {
            if (gameState === "PLAYING") {
                spawnObject();
                if (Math.random() > 0.6) spawnObject(); // burst
            }
        }, difficulty.spawnInterval);
    }
    function playSound(name) {
        const s = sounds[name];
        if (!s) return;
        s.currentTime = 0;
        s.play().catch(() => { });
    }

    function showGameOverPopup() {
        const overlay = document.getElementById("gameover-overlay");
        const scoreText = document.getElementById("final-score");

        scoreText.textContent = `SCORE: ${score}`;
        overlay.style.display = "flex";
    }


};

// ================== UTIL ==================
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function shakeScreen(intensity = 6) {
    const body = document.body;
    body.style.transition = "transform 0.05s";
    body.style.transform = `translate(${Math.random() * intensity - 3}px, ${Math.random() * intensity - 3}px)`;
    setTimeout(() => body.style.transform = "translate(0,0)", 80);
}
