const cols = 60, rows = 60;
const cellSize = [148, 88]; // Image is 148x87 tho, but w/e, better than dealing with rounding or editing the image Kappa

const easelCanvas = document.getElementById('easeljs');
let stage;
// const stage = new createjs.StageGL("easeljs", {transparent:true, premultiply:true});

const img = new Image();
img.src = 'ewww.png';

const cellList = [];

const img2 = new Image();
img2.onload = function () {
    const canvasWidth = cols * cellSize[0];
    const canvasHeight = cols * cellSize[1];
    const halfWidth = Math.round(canvasWidth / 2);
    const halfCellWidth = Math.round(cellSize[0] / 2);
    const halfCellHeight = Math.round(cellSize[1] / 2);
    easelCanvas.width = canvasWidth;
    easelCanvas.height = canvasHeight;
    stage = new createjs.StageGL("easeljs", {transparent:true, premultiply:true});
    stage.scale = 0.5; // 50% (from 0 to 1)

    for (let y = 0; y < rows; y++) {
        const rowStartX = halfWidth - halfCellWidth - (y * halfCellWidth);

        for (let x = 0; x < cols; x++) {
            const cell = new createjs.Bitmap(img2);
            cellList.push(cell);
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

    function letTheFunBegin() {
        let index = 0;
        let maxLength = cellList.length;
        const raf = function () {
            if (index > 0) {
                cellList[index - 1].image = img2;
            }

            cellList[index].image = img;
            index++;

            if (index === maxLength) {
                index = 0;
            }

            stage.update();
            window.requestAnimationFrame(raf);
        };
        window.requestAnimationFrame(raf);
    }

    letTheFunBegin();
};
img2.src = 'cell.png';
