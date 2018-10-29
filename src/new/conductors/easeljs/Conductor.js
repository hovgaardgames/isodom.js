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
        this.tickUpdateGrid = true;
        this.tickUpdateItems = true;
        this.tickUpdate = true;

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
            itemRotated: this._itemUpdated.bind(this),
            draw: () => {
                this.updateItemIndexes();
            },
        });

        createjs.Ticker.timingMode = createjs.Ticker.RAF;
        createjs.Ticker.framerate = 144;
        createjs.Ticker.addEventListener("tick", this.handleTick.bind(this));
    }

    /**
     * Handle tick.
     */
    handleTick() {
        if (!this.tickUpdate) {
            return;
        }

        this.updateStages();
    }

    /**
     * Add item to EaselJs.
     * @param {IsoDomItem} item
     */
    itemAdded(item) {
        const resolvedImage = this.config.resolve(item.image().url);
        if (!resolvedImage || !resolvedImage.nodeName || resolvedImage.nodeName.toLowerCase() !== 'img') {
            throw new Error(`Resolved image must be of type HTMLImageElement for "${item.image().url}".`);
        }

        const displayObject = new createjs.Container();
        const image = new createjs.Bitmap(resolvedImage);
        displayObject.addChild(image);
        item.meta.displayObject = displayObject;
        this.itemsStage.addChild(item.meta.displayObject);
    }

    /**
     * Update item in easelJS
     * @param {IsoDomItem} item
     */
    _itemUpdated(item) {
        item.meta.displayObject.removeChild(item.meta.displayObject.children[0]);

        const resolvedImage = this.config.resolve(item.image().url);
        const image = new createjs.Bitmap(resolvedImage);
        item.meta.displayObject.addChild(image);
        item.meta.displayObject.setChildIndex(image, 0);
        this.updateItemPosition(item, item.meta.temporaryCell || item.cell);
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
        if (this.tickUpdateGrid) {
            this.gridStage.update();
        }

        if (this.tickUpdateItems) {
            this.itemsStage.update();
        }
    }

    /**
     * Update stage.
     */
    updateItemIndexes() {
        this.iso.items
            .sort((a, b) => a.cell.z - b.cell.z)
            .forEach((item, index) => {
                this.itemsStage.setChildIndex(item.meta.displayObject, index+1); // Start at 1 to ensure background stays at 0.
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
            destY = destY - Number(item.meta.displayObject.children[0].image.height) * item.meta.displayObject.scale + this.iso.config.cellSize[1];
        }

        if (pivots.includes('right')) {
            destX = destX - Number(item.meta.displayObject.children[0].image.width) * item.meta.displayObject.scale + this.iso.config.cellSize[0];
        }

        item.meta.displayObject.x = destX + image.offset.left;
        item.meta.displayObject.y = destY + image.offset.top;

        item.meta.temporaryCell = cell;
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
        this.config.gridTarget.width = window.innerWidth;
        this.config.gridTarget.height = window.innerHeight;
        this.config.itemsTarget.width = window.innerWidth;
        this.config.itemsTarget.height = window.innerHeight;
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
    }
}
