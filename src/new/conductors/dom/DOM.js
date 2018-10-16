/**
 * @typedef {Object} IsoDomDOMConductorConfig
 * @property {HTMLElement} [target]
 * @property {HTMLElement} [scrollContainer]
 * @property {IsoDomEvents} [events]
 * @property {string} [gridClass]
 * @property {string} [itemClass]
 * @property {string} [columnClass]
 * @property {string} [itemContainerClass]
 * @property {function(IsoDomItem)|null} [createNode]
 * @property {function(IsoDomCell):{ top: number, left: number }|null} [cellPosition]
 * @property {function(HTMLElement, IsoDomItem)|null} [updateNode]
 */

/**
 * @class IsoDomDOMConductor
 * @property {IsoDomDOMConductorConfig} config
 * @property {IsoDom|null} iso
 * @property {HTMLElement} itemContainer
 * @property {HTMLElement} grid
 * @implements {IsoDomConductor}
 */
class IsoDomDOMConductor {
    /**
     * IsoDomDOMConductor constructor.
     * @param {IsoDomDOMConductorConfig} config
     */
    constructor(config = {}) {
        this.grid = null;
        this.itemContainer = null;
        this.iso = null;
        this.config = {
            target: null,
            scrollContainer: null,
            gridClass: 'iso-dom',
            itemClass: 'iso-dom-item',
            columnClass: 'iso-dom__column',
            itemContainerClass: 'iso-dom-items',
            createNode: null,
            updateNode: null,
            cellPosition: null,
        };

        Object.assign(this.config, config);

        // Validate grid element
        if (!this.config.target || !this.config.target.nodeName) {
            throw new Error('`target` config property must be set and must be an HTMLElement.');
        }

        // Set scroll container if not provided
        if (!this.config.scrollContainer) {
            this.config.scrollContainer = this.config.target;
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
            itemAdded: this.mountItem.bind(this),
            renderCell: this.renderCell.bind(this),
        });
    }

    /**
     * Update IsoDomCell.
     * @param {IsoDomCell} cell
     */
    renderCell(cell) {
        if (this.iso.isDebugging()) {
            cell.meta.el.innerHTML = `X: ${cell.x}<br/>Y: ${cell.y}<br/>Z: ${cell.z || '-'}`;

            if (this.item) {
                cell.meta.el.style.backgroundColor = cell.isItemRoot() ? '#888888' : '#c3c3c3';
            } else {
                cell.meta.el.style.backgroundColor = '';
            }
        }

        if (cell.item && cell.isItemRoot()) {
            this.positionItemOnCell(cell.item, cell);

            if (cell.z === null) {
                cell.meta.el.style.zIndex = '';
            } else {
                cell.meta.el.style.zIndex = cell.z;
            }
        }
    }

    /**
     * Mount IsoDomItem to DOM.
     * @param {IsoDomItem} item
     */
    mountItem(item) {
        if (item.meta.el) {
            // Item already mounted
            return;
        }

        let node = null;
        if (item.defaults.createNode) {
            node = item.defaults.createNode(item);
        } else if (this.config.createNode) {
            node = this.config.createNode(item);
        } else {
            node = this.createNodeDefault(item);
        }

        node.classList.add(this.config.itemClass);
        this.itemContainer.appendChild(node);
        item.meta.el = node;

        if (item.defaults.updateNode) {
            item.defaults.updateNode(item);
        } else if (this.config.updateNode) {
            this.config.updateNode(item);
        } else {
            this.updateNodeDefault(node, item);
        }
    }

    /**
     * Create default node.
     * @param {IsoDomItem} item
     * @return {HTMLElement}
     */
    createNodeDefault(item) {
        return document.createElement('img');
    }

    /**
     * Update item node.
     * @param {HTMLElement} node
     * @param {IsoDomItem} item
     */
    updateNodeDefault(node, item) {
        const image = item.image();
        node.setAttribute('src', image.url);
        node.style.marginTop = `${image.offset.top}px`;
        node.style.marginLeft = `${image.offset.left}px`;
    }

    /**
     * Position the item on cell.
     * @param {IsoDomItem} item
     * @param {IsoDomCell} cell
     * @param {number} offsetTop
     * @param {number} offsetLeft
     */
    positionItemOnCell(item, cell, offsetTop = 0, offsetLeft = 0) {
        const position = this.getCellPosition(cell);
        item.meta.el.style.top = `${position.top + offsetTop}px`;
        item.meta.el.style.left = `${position.left + offsetLeft}px`;
    }

    /**
     * Get cell position.
     * @param {IsoDomCell} cell
     * @return {{top, left}}
     */
    getCellPosition(cell) {
        if (cell.meta.positionCache !== null) {
            return cell.meta.positionCache;
        }

        const rect = cell.meta.el.getBoundingClientRect();

        let top = 0;
        let left = 0;

        if (this.config.scrollContainer === document.body) {
            const body = document.body;
            const doc = document.documentElement;

            const scrollTop = (window.pageYOffset || doc.scrollTop || body.scrollTop) / (document.body.style.zoom || 1);
            const scrollLeft = (window.pageXOffset || doc.scrollLeft || body.scrollLeft) / (document.body.style.zoom || 1);

            top = rect.top + scrollTop;
            left = rect.left + scrollLeft;
        } else {
            top = rect.top + this.config.scrollContainer.scrollTop;
            left = rect.left + this.config.scrollContainer.scrollLeft;
        }

        cell.meta.positionCache = {
            top: Math.round(top),
            left: Math.round(left),
        };

        return cell.meta.positionCache;
    }

    /**
     * IsoDom event.
     * @private
     */
    _beforeInit() {
        // Grid
        const grid = document.createElement('div');
        grid.classList.add(this.config.gridClass);
        grid.style.width = (this.iso.config.columns * this.iso.config.cellSize[0]) + ((this.iso.config.columns + this.iso.config.cellSize[0]) / 2) + 'px';
        grid.style.height = (this.iso.config.rows * this.iso.config.cellSize[1]) + ((this.iso.config.columns + this.iso.config.cellSize[1]) / 2) + 'px';

        if (this.iso.config.debug) {
            grid.classList.add(`${this.config.gridClass}--debug`);
        }

        this.grid = grid;

        // Item container
        const itemContainer = document.createElement('div');
        itemContainer.classList.add(this.config.itemContainerClass);
        this.itemContainer = itemContainer;
    }

    /**
     * IsoDom event.
     * @param {IsoDomCell} cell
     * @private
     */
    _cellCreated(cell) {
        const node = document.createElement('div');
        node.classList.add(this.config.columnClass);
        node.setAttribute('column', String(cell.x));
        node.setAttribute('row', String(cell.y));
        node.style.width = this.iso.config.cellSize[0] + "px";
        node.style.height = this.iso.config.cellSize[1] + "px";
        node.__isodomcell__ = cell;

        // Add cell meta
        cell.meta.el = node;
        cell.meta.positionCache = null;

        this.grid.appendChild(node);
    }

    /**
     * IsoDom event.
     * @private
     */
    _afterInit() {
        // Clear grid elements
        this.config.target.innerHTML = '';

        // Add grid and item container to DOM
        this.config.target.appendChild(this.grid);
        this.config.target.appendChild(this.itemContainer);
    }
}
