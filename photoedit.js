function writemessage(msg) {
    document.getElementById("messages").innerHTML += msg + "<br>";
}
async function loadModels() {
    const MODEL_URL = '/';
    console.log("nns loading");
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    try {
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    }
    catch (e) {
        console.log(e);
    }
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.log("nns loaded");
}

function getavg(pixelall) {
    var avg = [0, 0, 0, 0];
    for (let i = 0; i < pixelall.length / 4; i++) {
        for (let j = 0; j < 4; j++) {
            avg[j] += pixelall[i * 4 + j];
        }
    }
}
function appendUint8ClampedArrays(array1, array2) {
    const combinedLength = array1.length + array2.length;
    const combinedArray = new Uint8ClampedArray(combinedLength);

    // Copy elements from array1
    combinedArray.set(array1, 0);

    // Copy elements from array2, starting at the end of array1
    combinedArray.set(array2, array1.length);

    return combinedArray;
}
function is_above_hair(left, ctr, right) {
    var min = left.slice(0, 4);
    var max = left.slice(0, 4);
    var total = appendUint8ClampedArrays(left, right); // left.concat(right);

    for (let i = 0; i < total.length / 4; i++) {
        for (let j = 0; j < 4; j++) {
            let v = total[i * 4 + j];
            if (v <= min[j]) {
                min[j] = v;
            }
            if (v >= max[j]) {
                max[j] = v;
            }
        }
    }
    // Double the size of the [min, max] size to allow values of ctr to be in that range.
    let avg = [0, 0, 0, 0];
    for (let j = 0; j < 4; j++) {
        avg[j] = (min[j] + max[j]) / 2;
    }
    for (let j = 0; j < 4; j++) {
        min[j] = min[j] - Math.max(2, (avg[j] - min[j]));
        max[j] = max[j] + Math.max(2, (max[j] - avg[j]));
    }
    for (let j = 0; j < 4; j++) {
        if (ctr[j] > max[j] || ctr[j] < min[j]) {
            return false;
        }
    }
    return true;
}
function position_wrt_hairtop(ctx, center_head, y, width) {
    // console.log("h2");
    ctr = ctx.getImageData(center_head, y, 5, 1).data;
    left = ctx.getImageData(3, y, 5, 1).data;
    right = ctx.getImageData(width - 6, y, 5, 1).data;
    v = is_above_hair(left, ctr, right);
    // console.log(y, v);
    return v;
}

function top_of_head(canvas, top_head, center_head) {
    // console.log("h1");
    try {
        ctx = canvas.getContext('2d');
        // console.log("h3");

        // sort of binary search
        let jumpsize = 16;
        let cur = top_head
        let switchif = true;
        let deltadir = -1;
        while (jumpsize > 1) {
            while (position_wrt_hairtop(ctx, center_head, cur, canvas.width) != switchif) {
                cur += deltadir * jumpsize;
                if (cur >= canvas.height || cur <= 0) {
                    break;
                }
            }
            if (cur >= canvas.height || cur <= 0) {
                break;
            }
            jumpsize /= 2;
            // console.log("jump updated", jumpsize);
            deltadir *= -1;
            switchif = !switchif;
        }
        return cur;
    } catch (e) {
        console.log(e);
    }
}

function detectFaceBoundingBoxes(imageElement) {
    // writemessage("Messagewrite");
    try {
        faceapi.detectAllFaces(imageElement).withFaceLandmarks()
            .then(results => {
                // writemessage("Num Faces: " + results.length + results[0].detection + results[0].detection.box.x);
                // writemessage(results[0].landmarks.positions);
                const canvas = faceapi.createCanvasFromMedia(imageElement);

                // document.getElementById('output').appendChild(canvas);
                faceapi.draw.drawDetections(canvas, results);
                faceapi.draw.drawFaceLandmarks(canvas, results);
                var top = Math.floor(results[0].detection.box.top);
                var bottom = Math.floor(results[0].detection.box.bottom);
                var center = Math.floor((results[0].detection.box.topLeft.x + results[0].detection.box.topRight.x) / 2);
                toppos = top_of_head(canvas, top, center);

                try {
                    // Face should be 60% of image height. Add 10% at top and 30% at bottom.
                    fullheight = Math.floor((bottom - toppos) / .6)
                    pictop = Math.floor(toppos - fullheight * .1)
                    picbottom = Math.floor(bottom + fullheight * .3)
                    picright = center + fullheight * .5;
                    picleft = center - fullheight * .5;
                    console.log(fullheight, toppos, bottom, pictop, picbottom, picright, picleft);
                    var canvas2 = document.getElementById('outputedited');
                    const ctx2 = canvas2.getContext('2d');
                    canvas2.width = 1800;
                    canvas2.height = 1200;
                    for (var i = 0; i < 2; i++) {
                        for (var j = 0; j < 3; j++) {
                            ctx2.drawImage(imageElement, picleft, pictop, fullheight, fullheight, j * 600, i * 600, 600, 600);
                        }
                    }
                    document.getElementById("output").style.display = "block";
                    var canvasshow = document.getElementById("resized");
                    var canvasshowctx = canvasshow.getContext('2d');
                    var targetwidth = canvasshow.parentElement.offsetWidth;
                    canvasshow.width = targetwidth;
                    canvasshow.height = targetwidth * 2/3;
                    console.log(targetwidth);
                    canvasshowctx.drawImage(canvas2, 0, 0, targetwidth, targetwidth*2/3);
                    document.getElementById("input").style.display = "none";
                    document.getElementById("resized").style.display = "block";
                } catch (e) {
                    console.log(e);
                }


                return [toppos, bottom, center];
                // writemessage('Face boundiasdf ng boxes:', results[0]); // results.map(result => result.detection.box));
            })
            .catch(err => {
                console.log('Error detecting faces:', err);
            });
    }
    catch (e) {
        console.log(e);
    }
}
function drawHorizontalLine(canvas, y, width, color) {
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
}

// Example usage:

let changelistener = (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const imgElement = document.getElementById('inputImage');
            imgElement.src = e.target.result;
            imgElement.onload = () => {
                faceends = detectFaceBoundingBoxes(imgElement);
            };
        };
        reader.readAsDataURL(file);
    }
};

downloadlistener = function() {
    // Convert the canvas content to a data URL in JPG format
    var canvas = document.getElementById("outputedited");
    const imageData = canvas.toDataURL('image/jpeg', 1.0);  // 1.0 indicates the highest quality

    // Create a temporary link element
    const link = document.createElement('a');
    link.href = imageData;
    
    // Set the download attribute with a filename
    link.download = 'passport-photo.jpg';
    
    // Trigger a click on the link to download the image
    link.click();
};