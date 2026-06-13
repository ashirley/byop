"use strict";

function updateXY(event, xId, yId, minX, minY, maxX, maxY) {
    // event.offsetX/Y is measured in pixels and from the top left
    // We want our coords and origin in bottom left.

    const targetWidth = maxX - minX
    const targetHeight = maxY - minY
    const sourceWidth = event.srcElement.width
    const sourceHeight = event.srcElement.height
    const sourceX = event.offsetX
    const sourceY = event.offsetY

    const targetX = minX + (sourceX*targetWidth/sourceWidth)
    const targetY = maxY - (minY + (sourceY*targetHeight/sourceHeight))

    document.getElementById(xId).value = targetX.toFixed();
    document.getElementById(yId).value = targetY.toFixed();
}