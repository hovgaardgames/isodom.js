/**
 * @typedef {Object} IsoDomEaselJsConductorConfig
 * @property {HTMLCanvasElement} gridTarget
 * @property {HTMLCanvasElement} itemsTarget
 * @property {Object.<string, *>} stageConfig
 * @property {HTMLImageElement} image
 * @property {function(IsoDomItem):HTMLImageElement} resolve
 * @property {'top-left'|'top-right'|'left-top'|'right-top'|'bottom-left'|'bottom-right'|'left-bottom'|'right-bottom'} offsetPivot
 */

/**
 * @class IsoDomEaselJsConductor
 * @property {IsoDomEaselJsConductorConfig} config
 * @property {createjs.StageGL} gridStage
 * @property {createjs.StageGL} itemsStage
 * @implements {IsoDomConductor}
 */
class IsoDomEaselJsConductor {
    /**
     * IsoDomEaselJsConductor constructor.
     * @param {IsoDomEaselJsConductorConfig} config
     */
    constructor(config = {}) {
        this.gridStage = null;
        this.itemsStage = null;
        this.config = {
            gridTarget: null,
            itemsTarget: null,
            stageConfig: {},
            image: null,
            resolve: null,
            offsetPivot: 'top-left',
        };

        Object.assign(this.config, config);

        // Validate elements
        if (!this.config.gridTarget || !this.config.gridTarget.nodeName || this.config.gridTarget.nodeName.toLowerCase() !== 'canvas') {
            throw new Error('`gridTarget` config property must be set and must be an HTMLCanvasElement.');
        }

        if (!this.config.itemsTarget || !this.config.itemsTarget.nodeName || this.config.itemsTarget.nodeName.toLowerCase() !== 'canvas') {
            throw new Error('`itemsTarget` config property must be set and must be an HTMLCanvasElement.');
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
            itemMoved: this._itemMoved.bind(this),
            renderCell: this.renderCell.bind(this),
            draw: this.updateStages.bind(this),
        });
    }

    /**
     * Add item to EaselJs.
     * @param {IsoDomItem} item
     */
    itemAdded(item) {
        item.meta.displayObject = new createjs.Bitmap(this.config.resolve(item.image().url));
        this.itemsStage.addChild(item.meta.displayObject);
    }

    /**
     * Update IsoDomCell.
     * @param {IsoDomCell} cell
     */
    renderCell(cell) {
        if (cell.isItemRoot()) {
            this.updateItemPosition(cell.item, cell);
        }
    }

    /**
     * Update all stages.
     */
    updateStages() {
        this.gridStage.update();
        this.itemsStage.update();
    }

    /**
     * Update stage.
     */
    updateItemIndexes() {
        this.iso.items
            .sort((a, b) => a.cell.z - b.cell.z)
            .forEach((item, index) => {
                this.itemsStage.setChildIndex(item.meta.displayObject, this.iso.config.rows * this.iso.config.columns + index);
            });
    }

    /**
     * Update item position to cell.
     * @param {IsoDomItem} item
     * @param {IsoDomCell} cell
     */
    updateItemPosition(item, cell) {
        const pivots = this.config.offsetPivot.split('-');

        let image = item.image();
        let destX = Number(cell.meta.displayObject.x);
        let destY = Number(cell.meta.displayObject.y);

        if (pivots.includes('bottom')) {
            destY = destY - Number(item.meta.displayObject.image.height) * item.meta.displayObject.scale + this.iso.config.cellSize[1];
        }

        if (pivots.includes('right')) {
            destX = destX - Number(item.meta.displayObject.image.width) * item.meta.displayObject.scale + this.iso.config.cellSize[0];
        }

        item.meta.displayObject.x = destX + image.offset.left;
        item.meta.displayObject.y = destY + image.offset.top;
    }

    /**
     * IsoDom event.
     * @private
     */
    _itemMoved(item, fromCell, toCell) {
        this.updateItemPosition(item, toCell);
    }

    /**
     * IsoDom event.
     * @private
     */
    _beforeInit() {
        this.config.gridTarget.width = this.iso.config.cellSize[0] * this.iso.config.columns;
        this.config.gridTarget.height = this.iso.config.cellSize[1] * this.iso.config.rows;
        this.config.itemsTarget.width = this.iso.config.cellSize[0] * this.iso.config.columns;
        this.config.itemsTarget.height = this.iso.config.cellSize[1] * this.iso.config.rows;
        this.gridStage = new createjs.StageGL(this.config.gridTarget, Object.assign({ transparent: false, antialias: true }, this.config.stageConfig || {}));
        this.itemsStage = new createjs.StageGL(this.config.itemsTarget, Object.assign({ antialias: true }, this.config.stageConfig || {}, { transparent: true }));
        this.itemsStage.nextStage = this.gridStage;

        this.config.gridTarget.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });
        this.config.itemsTarget.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });
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

        this.gridStage.addChild(displayObject);
    }

    /**
     * IsoDom event.
     * @private
     */
    _afterInit() {
        this.updateItemIndexes();
        this.updateStages();
    }
}
