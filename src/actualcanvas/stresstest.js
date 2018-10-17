let handleComplete = () => {
    const cols = 50, rows = 50;
    const cellSize = [148, 88]; // Image is 148x87 tho, but w/e, better than dealing with rounding or editing the image Kappa

    const easelCanvas = document.getElementById('easeljs');
    let stage;
// const stage = new createjs.StageGL("easeljs", {transparent:true, premultiply:true});

    const cellList = [];

    const canvasWidth = cols * cellSize[0];
    const canvasHeight = cols * cellSize[1];
    const halfWidth = Math.round(canvasWidth / 2);
    const halfCellWidth = Math.round(cellSize[0] / 2);
    const halfCellHeight = Math.round(cellSize[1] / 2);
    easelCanvas.width = canvasWidth;
    easelCanvas.height = canvasHeight;
    stage = new createjs.StageGL("easeljs", {transparent: false , premultiply: true});
    stage.scale = 0.5; // 50% (from 0 to 1)

    for (let y = 0; y < rows; y++) {
        const rowStartX = halfWidth - halfCellWidth - (y * halfCellWidth);

        for (let x = 0; x < cols; x++) {
            const cell = new createjs.Bitmap(preload.getResult('black-cell'));
            cellList.push(cell);
            cell.addEventListener('mouseover', function () {
                cell.image = preload.getResult('red-cell');
                //stage.update();
                console.log(`cell over: x: ${x}; y: ${y}`);
            });

            cell.x = rowStartX + x * halfCellWidth;
            cell.y = (halfCellHeight * x) + (halfCellHeight * y);
            stage.addChild(cell);
        }
    }

    stage.enableMouseOver(20000);
    stage.update();

    function letTheFunBegin() {
        let index = 0;
        let maxLength = cellList.length;
        const raf = function () {
            if (index > 0) {
                cellList[index - 1].image = preload.getResult('black-cell');
            }

            cellList[index].image = preload.getResult('red-cell');
            index++;

            if (index === maxLength) {
                index = 0;
            }

            stage.update();
            window.requestAnimationFrame(raf);
        };
        window.requestAnimationFrame(raf);
    }

    //letTheFunBegin();
};

// Preload
preload = new createjs.LoadQueue(true);
preload.on("complete", handleComplete);
preload.loadManifest([
    {src: "ewww.png", id: "red-cell"},
    {src: "cell.png", id: "black-cell"},
]);