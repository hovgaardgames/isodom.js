/**
 * @typedef {Object} IsoDomEaselJsConductorConfig
 * @property {HTMLCanvasElement} target
 * @property {Object.<string, *>} stageConfig
 */

/**
 * @class IsoDomEaselJsConductor
 * @property {IsoDomEaselJsConductorConfig} config
 * @property {createjs.StageGL} stage
 * @implements {IsoDomConductor}
 */
class IsoDomEaselJsConductor {
    /**
     * IsoDomEaselJsConductor constructor.
     * @param {IsoDomEaselJsConductorConfig} config
     */
    constructor(config = {}) {
        this.stage = null;
        this.config = {
            target: null,
            stageConfig: {},
            image: null,
            resolve: null,
        };

        Object.assign(this.config, config);

        // Validate grid element
        if (!this.config.target || !this.config.target.nodeName || this.config.target.nodeName.toLowerCase() !== 'canvas') {
            throw new Error('`target` config property must be set and must be an HTMLCanvasElement.');
        }
    }

    /**
     * Set IsoDom instance.
     * @param {IsoDom} isoDom
     */
    setIsoDom(isoDom) {
        this.iso = isoDom;

        isoDom.on({
            beforeInit: this._beforeInit.bind(this),
            cellCreated: this._cellCreated.bind(this),
            afterInit: this._afterInit.bind(this),
            itemAdded: this.itemAdded.bind(this),
            renderCell: this.renderCell.bind(this),
            draw: this.updateStage.bind(this),
        });
    }

    /**
     * Add item to EaselJs.
     * @param {IsoDomItem} item
     */
    itemAdded(item) {
        item.meta.displayObject = new createjs.Bitmap(this.config.resolve(item.image().url));
        this.stage.addChild(item.meta.displayObject);
    }

    /**
     * Update IsoDomCell.
     * @param {IsoDomCell} cell
     */
    renderCell(cell) {
        if (cell.item) {
            cell.item.meta.displayObject.x = Number(cell.meta.displayObject.x);
            cell.item.meta.displayObject.y = Number(cell.meta.displayObject.y);
        }
    }

    /**
     * Update stage.
     */
    updateStage() {
        // TODO Optimize by providing two-way reference (cell <-> item)?

        const cells = [];
        for (let row = 0; row < this.iso.config.rows; row++) {
            for (let col = 0; col < this.iso.config.columns; col++) {
                const cell = this.iso.cell(col, row);

                if (cell.item) {
                    cells.push(cell);
                }
            }
        }

        cells
            .sort((a, b) => a - b)
            .forEach((cell, index) => {
                this.stage.setChildIndex(cell.item.meta.displayObject, this.iso.config.rows * this.iso.config.columns + index);
            });

        this.stage.update();
    }

    /**
     * IsoDom event.
     * @private
     */
    _beforeInit() {
        this.config.target.width = this.iso.config.cellSize[0] * this.iso.config.columns;
        this.config.target.height = this.iso.config.cellSize[1] * this.iso.config.rows;
        this.stage = new createjs.StageGL(this.config.target, Object.assign({ transparent: false }, this.config.stageConfig || {}));
    }

    /**
     * IsoDom event.
     * @param {IsoDomCell} cell
     * @private
     */
    _cellCreated(cell) {
        // TODO cache these calcs
        const canvasWidth = this.iso.config.cellSize[0] * this.iso.config.columns;
        const halfWidth = Math.round(canvasWidth / 2);
        const halfCellWidth = Math.round(this.iso.config.cellSize[0] / 2);
        const halfCellHeight = Math.round(this.iso.config.cellSize[1] / 2);
        const rowStartX = halfWidth - halfCellWidth - (cell.y * halfCellWidth);

        // Dynamic display object?
        const displayObject = new createjs.Bitmap(this.config.image);
        displayObject.x = rowStartX + cell.x * halfCellWidth;
        displayObject.y = (halfCellHeight * cell.x) + (halfCellHeight * cell.y);

        cell.meta.displayObject = displayObject;

        this.stage.addChild(displayObject);
    }

    /**
     * IsoDom event.
     * @private
     */
    _afterInit() {
        this.stage.update();
    }
}
