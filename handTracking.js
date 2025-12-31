let handDetected = false;
let handLandmarks = null;
let indexFinger = { x: 0, y: 0 };
let currentGesture = "NONE"; // FIST | PALM | POINT

const hands = new Hands({
    locateFile: file =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults(results => {

    // ❌ No hand detected
    if (
        !results.multiHandLandmarks ||
        results.multiHandLandmarks.length === 0
    ) {
        handDetected = false;
        handLandmarks = null;
        currentGesture = "NONE";
        return;
    }

    const landmarks = results.multiHandLandmarks[0];
    handLandmarks = landmarks;

    // ❌ Safety check (IMPORTANT)
    if (!landmarks || landmarks.length < 21) {
        return;
    }

    handDetected = true;

    // Index fingertip (landmark 8)
    indexFinger.x = landmarks[8].x;
    indexFinger.y = landmarks[8].y;

    detectGesture(landmarks);
});

function detectGesture(landmarks) {
    const tips = [8, 12, 16, 20];
    let foldedCount = 0;

    tips.forEach(tip => {
        if (landmarks[tip].y > landmarks[tip - 2].y) {
            foldedCount++;
        }
    });

    if (foldedCount === 4) {
        currentGesture = "FIST";
    } else if (foldedCount === 0) {
        currentGesture = "PALM";
    } else {
        currentGesture = "POINT";
    }
}
