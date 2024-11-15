function writemessage(msg) {
    document.getElementById("messages").innerHTML += msg + "<br>";
}


var facepositions = null;
var croppedcanvas = null;
var canvastodownload = null;

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
    croppedcanvas = document.createElement('canvas');
    canvastodownload = document.createElement('canvas');
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

// function that takes the required width and height and crops original image to that size.
function getcropdimensions(center, headtop, headbottom, width, height) {
    let cropheight = Math.floor((headbottom - headtop) / .6);
    let croptop = Math.floor(headtop - cropheight * .1);
    let cropbottom = Math.floor(headbottom + cropheight * .3);
    let aspectratio = width / height;
    let cropwidth = Math.floor(cropheight * aspectratio);
    let cropleft = center - cropwidth / 2;
    let cropright = center + cropwidth / 2;
    return [cropleft, croptop, cropwidth, cropheight];
}

function edittoaspectratio(inputcanvas, center, top, bottom, width, height, outputcanvas) {
    let cropspec = getcropdimensions(center, top, bottom, width, height);
    let cropleft = cropspec[0];
    let croptop = cropspec[1];
    let cropwidth = cropspec[2];
    let cropheight = cropspec[3];
    ctx2 = outputcanvas.getContext('2d');
    outputcanvas.width = width;
    outputcanvas.height = height;
    ctx2.drawImage(inputcanvas, cropleft, croptop, cropwidth, cropheight, 0, 0, width, height);
}

function GenerateCanvasWithMultipleCopiesOfINput(inputcanvas, outwidth, outheight, imgwidth, outputcanvas) {
    let mulfactor = inputcanvas.width / imgwidth;
    imgwidth = inputcanvas.width;
    imgheight = inputcanvas.height;
    outwidth = Math.ceil(outwidth * mulfactor);
    outheight = Math.ceil(outheight * mulfactor);

    outputcanvas.width = outwidth;
    outputcanvas.height = outheight;
    ctx2 = outputcanvas.getContext('2d');        

    let numx = Math.floor(outwidth / imgwidth);
    let numy = Math.floor(outheight / imgheight);
    for (let i = 0; i < numx; i++) {
        for (let j = 0; j < numy; j++) {
            ctx2.drawImage(inputcanvas, 0, 0, imgwidth, imgheight, i * imgwidth, j * imgheight, imgwidth, imgheight);
        }
    }
}

function updatedisplay(inputcanvas) {
    let targetwidth = document.getElementById("resized").offsetWidth;

    width = inputcanvas.width;
    height = inputcanvas.height;
    outcanvas = document.getElementById("resized");
    outcanvas.width = targetwidth;
    outcanvas.height = Math.ceil(targetwidth * height * 1.0 / width);
    ctx2 = outcanvas.getContext('2d');
    ctx2.drawImage(inputcanvas, 0, 0, width, height, 0, 0, targetwidth, Math.ceil(targetwidth * height * 1.0 / width));
}

function toggleForm(formid) {
    document.getElementById(formid).style.display = document.getElementById(formid).style.display === 'none' ? 'block' : 'none';
}

function UpdateAspectRatios(ind_w, ind_h, print_w, print_h) {
    edittoaspectratio(document.getElementById("input"), facepositions[2], facepositions[0], facepositions[1], 400, Math.floor(400.0 * ind_h / ind_w), croppedcanvas);
    outputcanvas = document.getElementById('outputedited');
    GenerateCanvasWithMultipleCopiesOfINput(croppedcanvas, print_w, print_h, ind_w, outputcanvas );
    updatedisplay(outputcanvas);
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
                facepositions = [top, bottom, center];

                try {
                    edittoaspectratio(imageElement, center, toppos, bottom, 400, 400, croppedcanvas);
                    outputcanvas = document.getElementById('outputedited');
                    GenerateCanvasWithMultipleCopiesOfINput(croppedcanvas, 1800, 1200, 600, outputcanvas );
                    updatedisplay(outputcanvas);

                    // // Face should be 60% of image height. Add 10% at top and 30% at bottom.
                    // fullheight = Math.floor((bottom - toppos) / .6)
                    // pictop = Math.floor(toppos - fullheight * .1)
                    // picbottom = Math.floor(bottom + fullheight * .3)
                    // picright = center + fullheight * .5;
                    // picleft = center - fullheight * .5;
                    // console.log(fullheight, toppos, bottom, pictop, picbottom, picright, picleft);
                    // var canvas2 = document.getElementById('outputedited');
                    // const ctx2 = canvas2.getContext('2d');
                    // canvas2.width = 1800;
                    // canvas2.height = 1200;
                    // for (var i = 0; i < 2; i++) {
                    //     for (var j = 0; j < 3; j++) {
                    //         ctx2.drawImage(imageElement, picleft, pictop, fullheight, fullheight, j * 600, i * 600, 600, 600);
                    //     }
                    // }
                    // document.getElementById("output").style.display = "block";
                    // var canvasshow = document.getElementById("resized");
                    // var canvasshowctx = canvasshow.getContext('2d');
                    // var targetwidth = canvasshow.parentElement.offsetWidth;
                    // canvasshow.width = targetwidth;
                    // canvasshow.height = targetwidth * 2/3;
                    // console.log(targetwidth);
                    // canvasshowctx.drawImage(canvas2, 0, 0, targetwidth, targetwidth*2/3);
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
    gtag('event', 'imguploaded', {});
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
    gtag('event', 'downloaded', {});
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
    window.location.href = "/thankyou.html";
};

thankyoufeedback = function() {
  document.getElementById("feedbackbox").style.display = "none";
  document.getElementById("feedbackthanks").style.display = "block";
};
