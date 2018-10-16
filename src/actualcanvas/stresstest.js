const cols = 25, rows = 25;
const cellSize = [148, 88]; // Image is 148x87 tho, but w/e, better than dealing with rounding or editing the image Kappa

const easelCanvas = document.getElementById('easeljs');
const stage = new createjs.Stage("easeljs");

const img = new Image();
img.src = 'ewww.png';

const img2 = new Image();
img2.onload = function () {
    const canvasWidth = cols * cellSize[0];
    const canvasHeight = cols * cellSize[1];
    const halfWidth = Math.round(canvasWidth / 2);
    const halfCellWidth = Math.round(cellSize[0] / 2);
    const halfCellHeight = Math.round(cellSize[1] / 2);
    easelCanvas.width = canvasWidth;
    easelCanvas.height = canvasHeight;

    for (let y = 0; y < rows; y++) {
        const rowStartX = halfWidth - halfCellWidth - (y * halfCellWidth);

        for (let x = 0; x < cols; x++) {
            const cell = new createjs.Bitmap(img2);
            cell.addEventListener('mouseover', function () {
                cell.image = img;
                stage.update();
                console.log(`cell over: x: ${x}; y: ${y}`);
            });
            cell.addEventListener('mouseout', function () {
                cell.image = img2;
                stage.update();
            });
            cell.x = rowStartX + x * halfCellWidth;
            cell.y = (halfCellHeight * x) + (halfCellHeight * y);

            stage.addChild(cell);
        }
    }

    stage.enableMouseOver(20);
    stage.update();
};
img2.src = 'cell.png';
