/**
 * Quick Product Edit Module for OpenCart 3.0.4.1
 * Provides inline editing and creation of products directly from product list
 */
class QuickProductEdit {
constructor() {
    this.isFullscreen = false;
    this.isLoading = false;
    this.visibleFields = this.getStoredVisibleFields();
    this.fieldData = null;
    this.currentProductId = null;
    this.initialized = false;
    this.isNewProduct = false;
    
    // File manager properties
    this.currentImageTarget = null;
    this.currentImagePreview = null;
    
    // Set global instance reference
    window.quickEditInstance = this;
    
    this.init();
}

    init() {
        if (this.initialized) return;
        
        console.log('Initializing Quick Product Edit...');
        
        // Проверка дали сме на страница с продукти
        if (!this.isProductPage()) {
            console.log('Not on product page, skipping initialization');
            return;
        }
        
        this.waitForProductList().then(() => {
            this.addEditButtons();
            this.addCreateButton();
            this.setupEventListeners();
            this.applyFieldVisibility();
            this.initialized = true;
            console.log('Quick Product Edit initialized successfully');
        }).catch(error => {
            console.log('Product list not found, retrying...');
            setTimeout(() => this.init(), 1000);
        });
    }

    isProductPage() {
        // Проверка дали сме в административната част и на страница с продукти
        const isAdmin = window.location.href.includes('/admin/');
        const isProductPage = window.location.href.includes('catalog/product');
        const isNotEditPage = !window.location.href.includes('add') && !window.location.href.includes('edit');
        return isAdmin && isProductPage && isNotEditPage;
    }

    waitForProductList() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 10;
            
            const checkExist = setInterval(() => {
                attempts++;
                const productTable = this.findProductTable();
                if (productTable) {
                    clearInterval(checkExist);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkExist);
                    reject('Product table not found after ' + maxAttempts + ' attempts');
                }
            }, 500);
        });
    }

    findProductTable() {
        // Различни селектори за продуктовия списък в OpenCart
        const selectors = [
            '#form-product',
            'form[action*="product"]',
            '.table-responsive table',
            'table.table'
        ];
        
        for (let selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                console.log('Found product table with selector:', selector);
                return element;
            }
        }
        return null;
    }

    addEditButtons() {
        const productRows = this.getProductRows();
        console.log(`Adding edit buttons to ${productRows.length} products`);
        
        productRows.forEach(row => {
            const productId = this.getProductIdFromRow(row);
            if (!productId) return;

            // Проверка дали бутонът вече съществува
            if (row.querySelector('.quick-edit-btn')) {
                return;
            }

            const editBtn = this.createQuickEditButton(productId);
            this.insertEditButton(row, editBtn);
        });
    }

    getProductRows() {
        const table = this.findProductTable();
        if (!table) return [];
        
        // Търсим редове в tbody, които имат checkbox за избор на продукт
        const rows = table.querySelectorAll('tbody tr');
        return Array.from(rows).filter(row => {
            const checkbox = row.querySelector('input[type="checkbox"][name="selected[]"]');
            return checkbox && checkbox.value;
        });
    }

    getProductIdFromRow(row) {
        const checkbox = row.querySelector('input[type="checkbox"][name="selected[]"]');
        return checkbox ? checkbox.value : null;
    }

    insertEditButton(row, editBtn) {
        const actionsCell = row.querySelector('td.text-right, td:last-child');
        if (!actionsCell) {
            console.warn('Actions cell not found in row');
            return;
        }

        // Търсим съществуващия edit бутон
        const existingEditBtn = actionsCell.querySelector('a[href*="edit"], a.btn-primary, .btn-default');
        
        if (existingEditBtn) {
            // Вмъкваме след съществуващия edit бутон
            existingEditBtn.parentNode.insertBefore(editBtn, existingEditBtn.nextSibling);
            // Добавяме малко разстояние
            editBtn.style.marginLeft = '5px';
        } else {
            // Ако няма друг бутон, просто добавяме
            actionsCell.insertBefore(editBtn, actionsCell.firstChild);
        }
        
        console.log('Quick edit button added for product');
    }

    addCreateButton() {
        // Търсим контейнера за бутони в горния десен ъгъл
        const headerSelectors = [
            '.page-header .pull-right',
            '.page-header .float-end',
            '.page-header .buttons',
            '.container-fluid .pull-right',
            '.panel-heading .pull-right'
        ];
        
        let headerContainer = null;
        for (let selector of headerSelectors) {
            headerContainer = document.querySelector(selector);
            if (headerContainer) break;
        }
        
        if (!headerContainer) {
            console.warn('Header container not found for create button');
            return;
        }

        // Проверка дали бутонът вече съществува
        if (headerContainer.querySelector('.quick-create-btn')) {
            return;
        }

        const createBtn = document.createElement('button');
        createBtn.type = 'button';
        createBtn.className = 'btn btn-primary quick-create-btn';
        createBtn.innerHTML = '<i class="fa fa-plus"></i> ' + (window.quickEditTexts?.text_quick_create || 'Quick Create');
        createBtn.onclick = (e) => {
            e.preventDefault();
            this.openCreateModal();
        };
        
        // Вмъкваме бутона в началото
        headerContainer.insertBefore(createBtn, headerContainer.firstChild);
        console.log('Quick create button added');
    }

    createQuickEditButton(productId) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-default btn-sm quick-edit-btn';
        editBtn.innerHTML = '<i class="fa fa-bolt"></i> ' + (window.quickEditTexts?.text_quick_edit || 'Quick Edit');
        editBtn.setAttribute('data-product-id', productId);
        editBtn.style.marginLeft = '3px';
        editBtn.style.marginRight = '3px';
        editBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openEditModal(productId);
        };
        return editBtn;
    }

    setupEventListeners() {
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.isFullscreen) {
                    this.toggleFullscreen();
                }
                this.closeModal();
            }
        });

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            const modal = document.querySelector('.quick-edit-modal');
            if (modal && e.target === modal) {
                this.closeModal();
            }
        });

        // Observe DOM changes for dynamic content (pagination, filters, etc.)
        this.observeDOMChanges();
    }

    observeDOMChanges() {
        const observer = new MutationObserver((mutations) => {
            let shouldReinit = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            if (node.querySelector && (
                                node.querySelector('#form-product') ||
                                node.querySelector('input[name="selected[]"]') ||
                                node.classList.contains('pagination')
                            )) {
                                shouldReinit = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldReinit) {
                console.log('DOM changed, reinitializing buttons...');
                setTimeout(() => {
                    this.addEditButtons();
                    this.addCreateButton();
                }, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    async openEditModal(productId) {
        if (this.isLoading) return;

        this.currentProductId = productId;
        this.isNewProduct = false;
        this.showLoading();

        try {
            await this.loadFieldData();
            const productData = await this.loadProductData(productId);
            this.showModal(productData);
        } catch (error) {
            console.error('Error opening edit modal:', error);
            this.showNotification('Error loading product data: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async openCreateModal() {
        if (this.isLoading) return;

        this.currentProductId = null;
        this.isNewProduct = true;
        this.showLoading();

        try {
            await this.loadFieldData();
            const emptyProductData = this.getEmptyProductData();
            this.showModal(emptyProductData);
        } catch (error) {
            console.error('Error opening create modal:', error);
            this.showNotification('Error loading field data: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    getEmptyProductData() {
        return {
            name: '',
            model: '',
            sku: '',
            price: '',
            quantity: 0,
            status: 1,
            product_description: {},
            product_category: [],
            product_filter: [],
            product_attribute: [],
            product_option: [],
            product_related: [],
            product_image: [],
            product_download: [],
            product_store: [0],
            product_layout: [],
            product_special: []
        };
    }

    async loadFieldData() {
        if (this.fieldData) return;

        const response = await this.makeRequest('getFieldData');
        if (response.success) {
            this.fieldData = response;
        } else {
            throw new Error('Failed to load field data');
        }
    }

    async loadProductData(productId) {
        const response = await this.makeRequest('getProductData', { product_id: productId });
        
        if (response.success) {
            return response;
        } else {
            throw new Error(response.error || 'Failed to load product data');
        }
    }

    showModal(productData) {
        const modal = this.createModal(productData);
        document.body.appendChild(modal);
        
        const backdrop = document.createElement('div');
        backdrop.className = 'overlay-backdrop';
        backdrop.style.display = 'block';
        document.body.appendChild(backdrop);

        modal.style.display = 'block';
        
        this.setupModalHandlers(modal, productData);
    }

    createModal(productData) {
        const modal = document.createElement('div');
        modal.className = 'quick-edit-modal';
        modal.innerHTML = this.getModalHTML(productData);
        return modal;
    }

    getModalHTML(productData) {
        const title = this.isNewProduct ? 
            'Create New Product' : 
            `Edit Product: ${this.escapeHtml(productData.name || 'Unknown Product')}`;
        
        return `
            <div class="quick-edit-content">
                <div class="quick-edit-header">
                    <h3><i class="fa ${this.isNewProduct ? 'fa-plus' : 'fa-edit'}"></i> ${title}</h3>
                    <div class="quick-edit-controls">
                        <button type="button" class="field-visibility-btn" title="${window.quickEditTexts?.field_visibility || 'Field Visibility'}">
                            <i class="fa fa-eye"></i> ${window.quickEditTexts?.field_visibility || 'Fields'}
                        </button>
                        <button type="button" class="fullscreen-btn" title="${window.quickEditTexts?.fullscreen || 'Fullscreen'}">
                            <i class="fa fa-expand"></i> ${window.quickEditTexts?.fullscreen || 'Fullscreen'}
                        </button>
                        <button type="button" class="save-btn btn-primary">
                            <i class="fa fa-save"></i> ${this.isNewProduct ? 'Create' : (window.quickEditTexts?.save || 'Save')}
                        </button>
                        <button type="button" class="close-btn">
                            <i class="fa fa-times"></i> ${window.quickEditTexts?.close || 'Close'}
                        </button>
                    </div>
                </div>
                
                <div class="quick-edit-body">
                    <form class="quick-edit-form">
                        <div class="quick-edit-tabs">
                            <div class="tab-buttons">
                                <button type="button" class="tab-button active" data-tab="general">General</button>
                                <button type="button" class="tab-button" data-tab="data-images">Data & Images</button>
                                <button type="button" class="tab-button" data-tab="links-attributes">Links & Attributes</button>
                                <button type="button" class="tab-button" data-tab="options">Options</button>
                            </div>
                            
                            <div class="tab-content active" data-tab="general">
                                ${this.generateGeneralTab(productData)}
                            </div>
                            
                            <div class="tab-content" data-tab="data-images">
                                ${this.generateDataImagesTab(productData)}
                            </div>
                            
                            <div class="tab-content" data-tab="links-attributes">
                                ${this.generateLinksAttributesTab(productData)}
                            </div>
                            
                            <div class="tab-content" data-tab="options">
                                ${this.generateOptionsTab(productData)}
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            
            <div class="field-visibility-controls">
                <h4><i class="fa fa-eye"></i> ${window.quickEditTexts?.field_visibility || 'Visible Fields'}</h4>
                <div class="visibility-checkboxes" id="visibility-checkboxes">
                    ${this.generateVisibilityCheckboxes()}
                </div>
                <div style="margin-top: 15px; text-align: center;">
                    <button type="button" class="btn btn-default close-visibility">Close</button>
                </div>
            </div>
        `;
    }

    generateGeneralTab(productData) {
        return `
            <div class="quick-edit-fields">
                <div class="field-group-section">
                    <h4>Basic Information</h4>
                    ${this.generateLanguageFields(productData.product_description)}
                </div>

                <div class="field-group-section">
                    <h4>Pricing & Inventory</h4>
                    <div class="quick-edit-field-group" data-field="model">
                        <label for="field_model">${this.getFieldLabel('model')}</label>
                        <input type="text" id="field_model" name="model" value="${this.escapeHtml(productData.model || '')}" class="form-control">
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="price">
                        <label for="field_price">${this.getFieldLabel('price')}</label>
                        <input type="number" id="field_price" name="price" value="${this.escapeHtml(productData.price || '')}" step="0.01" class="form-control">
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="special_price">
                        <label for="field_special_price">Special Price</label>
                        <input type="number" id="field_special_price" name="special_price" value="" step="0.01" class="form-control" placeholder="Enter special price">
                        <small class="text-muted">Special price will be active from today</small>
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="quantity">
                        <label for="field_quantity">${this.getFieldLabel('quantity')}</label>
                        <input type="number" id="field_quantity" name="quantity" value="${this.escapeHtml(productData.quantity || '0')}" class="form-control">
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="minimum">
                        <label for="field_minimum">${this.getFieldLabel('minimum')}</label>
                        <input type="number" id="field_minimum" name="minimum" value="${this.escapeHtml(productData.minimum || '1')}" class="form-control">
                    </div>
                </div>

                <div class="field-group-section">
                    <h4>Status & SEO</h4>
                    <div class="quick-edit-field-group" data-field="status">
                        <label for="field_status">${this.getFieldLabel('status')}</label>
                        <select id="field_status" name="status" class="form-control">
                            <option value="1" ${productData.status == 1 ? 'selected' : ''}>Enabled</option>
                            <option value="0" ${productData.status == 0 ? 'selected' : ''}>Disabled</option>
                        </select>
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="sort_order">
                        <label for="field_sort_order">${this.getFieldLabel('sort_order')}</label>
                        <input type="number" id="field_sort_order" name="sort_order" value="${this.escapeHtml(productData.sort_order || '0')}" class="form-control">
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="seo_keyword">
                        <label for="field_seo_keyword">${this.getFieldLabel('seo_keyword')}</label>
                        <input type="text" id="field_seo_keyword" name="seo_keyword" value="${this.escapeHtml(productData.seo_keyword || '')}" class="form-control">
                    </div>
                </div>
            </div>
        `;
    }

    generateDataImagesTab(productData) {
        const manufacturers = this.fieldData?.manufacturers || [];
        const stockStatuses = this.fieldData?.stock_statuses || [];
        const taxClasses = this.fieldData?.tax_classes || [];
        const weightClasses = this.fieldData?.weight_classes || [];
        const lengthClasses = this.fieldData?.length_classes || [];
        
        // Fix date format for input type="date"
        const dateAvailable = productData.date_available && productData.date_available !== '0000-00-00' 
            ? productData.date_available 
            : '';
        
        return `
            <div class="quick-edit-fields">
                <div class="field-group-section">
                    <h4>Product Data</h4>
                    <div class="quick-edit-field-group" data-field="sku">
                        <label for="field_sku">${this.getFieldLabel('sku')}</label>
                        <input type="text" id="field_sku" name="sku" value="${this.escapeHtml(productData.sku || '')}" class="form-control">
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="upc">
                        <label for="field_upc">${this.getFieldLabel('upc')}</label>
                        <input type="text" id="field_upc" name="upc" value="${this.escapeHtml(productData.upc || '')}" class="form-control">
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="ean">
                        <label for="field_ean">${this.getFieldLabel('ean')}</label>
                        <input type="text" id="field_ean" name="ean" value="${this.escapeHtml(productData.ean || '')}" class="form-control">
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="jan">
                        <label for="field_jan">${this.getFieldLabel('jan')}</label>
                        <input type="text" id="field_jan" name="jan" value="${this.escapeHtml(productData.jan || '')}" class="form-control">
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="isbn">
                        <label for="field_isbn">${this.getFieldLabel('isbn')}</label>
                        <input type="text" id="field_isbn" name="isbn" value="${this.escapeHtml(productData.isbn || '')}" class="form-control">
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="mpn">
                        <label for="field_mpn">${this.getFieldLabel('mpn')}</label>
                        <input type="text" id="field_mpn" name="mpn" value="${this.escapeHtml(productData.mpn || '')}" class="form-control">
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="location">
                        <label for="field_location">${this.getFieldLabel('location')}</label>
                        <input type="text" id="field_location" name="location" value="${this.escapeHtml(productData.location || '')}" class="form-control">
                    </div>
                </div>

                <div class="field-group-section">
                    <h4>Manufacturer & Stock</h4>
                    <div class="quick-edit-field-group" data-field="manufacturer_id">
                        <label for="field_manufacturer_id">Manufacturer</label>
                        <select id="field_manufacturer_id" name="manufacturer_id" class="form-control">
                            <option value="0">--- None ---</option>
                            ${manufacturers.map(m => 
                                `<option value="${m.manufacturer_id}" ${m.manufacturer_id == productData.manufacturer_id ? 'selected' : ''}>${this.escapeHtml(m.name)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="stock_status_id">
                        <label for="field_stock_status_id">Stock Status</label>
                        <select id="field_stock_status_id" name="stock_status_id" class="form-control">
                            ${stockStatuses.map(s => 
                                `<option value="${s.stock_status_id}" ${s.stock_status_id == productData.stock_status_id ? 'selected' : ''}>${this.escapeHtml(s.name)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="tax_class_id">
                        <label for="field_tax_class_id">Tax Class</label>
                        <select id="field_tax_class_id" name="tax_class_id" class="form-control">
                            <option value="0">--- None ---</option>
                            ${taxClasses.map(t => 
                                `<option value="${t.tax_class_id}" ${t.tax_class_id == productData.tax_class_id ? 'selected' : ''}>${this.escapeHtml(t.title)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="date_available">
                        <label for="field_date_available">Date Available</label>
                        <input type="date" id="field_date_available" name="date_available" value="${this.escapeHtml(dateAvailable)}" class="form-control">
                    </div>
                </div>

                <div class="field-group-section">
                    <h4>Shipping & Dimensions</h4>
                    <div class="quick-edit-field-group" data-field="shipping">
                        <label for="field_shipping">${this.getFieldLabel('shipping')}</label>
                        <select id="field_shipping" name="shipping" class="form-control">
                            <option value="1" ${productData.shipping == 1 ? 'selected' : ''}>Yes</option>
                            <option value="0" ${productData.shipping == 0 ? 'selected' : ''}>No</option>
                        </select>
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="subtract">
                        <label for="field_subtract">${this.getFieldLabel('subtract')}</label>
                        <select id="field_subtract" name="subtract" class="form-control">
                            <option value="1" ${productData.subtract == 1 ? 'selected' : ''}>Yes</option>
                            <option value="0" ${productData.subtract == 0 ? 'selected' : ''}>No</option>
                        </select>
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="weight">
                        <label for="field_weight">${this.getFieldLabel('weight')}</label>
                        <div class="input-group">
                            <input type="number" id="field_weight" name="weight" value="${this.escapeHtml(productData.weight || '')}" step="0.001" class="form-control">
                            <select name="weight_class_id" class="form-control" style="max-width: 120px;">
                                ${weightClasses.map(w => 
                                    `<option value="${w.weight_class_id}" ${w.weight_class_id == productData.weight_class_id ? 'selected' : ''}>${this.escapeHtml(w.unit || w.title)}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="dimensions">
                        <label>Dimensions (L x W x H)</label>
                        <div class="row">
                            <div class="col-md-4">
                                <input type="number" name="length" value="${this.escapeHtml(productData.length || '')}" step="0.001" class="form-control" placeholder="Length">
                            </div>
                            <div class="col-md-4">
                                <input type="number" name="width" value="${this.escapeHtml(productData.width || '')}" step="0.001" class="form-control" placeholder="Width">
                            </div>
                            <div class="col-md-4">
                                <input type="number" name="height" value="${this.escapeHtml(productData.height || '')}" step="0.001" class="form-control" placeholder="Height">
                            </div>
                        </div>
                        <select name="length_class_id" class="form-control mt-2">
                            ${lengthClasses.map(l => 
                                `<option value="${l.length_class_id}" ${l.length_class_id == productData.length_class_id ? 'selected' : ''}>${this.escapeHtml(l.unit || l.title)}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>

                <div class="field-group-section">
                    <h4>Product Images</h4>
                    <div class="quick-edit-field-group" data-field="main_image">
                        <label>Main Image</label>
                        <div class="image-upload-container">
                            <div class="image-preview" id="main-image-preview" style="max-width: 200px; max-height: 200px; border: 1px solid #ddd; padding: 5px; margin-bottom: 10px;">
                                ${productData.image ? `<img src="${this.escapeHtml(productData.image)}" style="max-width: 100%; max-height: 100%;" />` : 'No image'}
                            </div>
                            <button type="button" class="btn btn-default btn-sm open-image-manager" data-target="main-image-input" data-preview="main-image-preview">
                                <i class="fa fa-folder-open"></i> Select Image
                            </button>
                            <input type="hidden" name="image" value="${this.escapeHtml(productData.image || '')}" id="main-image-input">
                        </div>
                    </div>
                    
                    <div class="quick-edit-field-group" data-field="additional_images">
                        <label>Additional Images</label>
                        <div id="additional-images-container">
                            ${this.generateAdditionalImages(productData.product_image || [])}
                        </div>
                        <button type="button" class="btn btn-default btn-sm mt-2 add-additional-image">
                            <i class="fa fa-plus"></i> Add Image
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

generateLinksAttributesTab(productData) {
    const categories = this.fieldData?.categories || [];
    const stores = this.fieldData?.stores || [];
    const attributeGroups = this.fieldData?.attribute_groups || [];
    const filters = this.fieldData?.filters || [];
    const downloads = this.fieldData?.downloads || [];
    
    return `
        <div class="quick-edit-fields">
            <div class="field-group-section">
                <h4>Categories & Stores</h4>
                <div class="quick-edit-field-group" data-field="categories">
                    <label>Categories</label>
                    <div class="category-list" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px;">
                        ${categories.map(category => `
                            <div class="checkbox">
                                <label>
                                    <input type="checkbox" name="product_category[]" value="${category.category_id}" 
                                        ${(productData.product_category || []).includes(parseInt(category.category_id)) ? 'checked' : ''}>
                                    ${this.escapeHtml(category.name)}
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="quick-edit-field-group" data-field="stores">
                    <label>Stores</label>
                    ${stores.map(store => `
                        <div class="checkbox">
                            <label>
                                <input type="checkbox" name="product_store[]" value="${store.store_id}" 
                                    ${(productData.product_store || [0]).includes(parseInt(store.store_id)) ? 'checked' : ''}>
                                ${this.escapeHtml(store.name || store.url)}
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="field-group-section">
                <h4>Filters</h4>
                <div class="quick-edit-field-group" data-field="filters">
                    <div class="filter-list" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px;">
                        ${this.generateFilterGroups(filters, productData.product_filter || [])}
                    </div>
                </div>
            </div>

            <div class="field-group-section">
                <h4>Attributes</h4>
                <div class="quick-edit-field-group" data-field="attributes">
                    <div class="panel panel-default">
                        <div class="panel-heading">
                            <h3 class="panel-title">
                                <i class="fa fa-list"></i> Product Attributes
                            </h3>
                        </div>
                        <div class="panel-body">
                            <div class="form-group">
                                <label class="col-sm-2 control-label" for="input-attribute">Attribute</label>
                                <div class="col-sm-10">
                                    <input type="text" name="attribute" value="" placeholder="Attribute" id="input-attribute" class="form-control" />
                                    <input type="hidden" name="attribute_id" value="" />
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="col-sm-2 control-label" for="input-text">Text</label>
                                <div class="col-sm-10">
                                    <textarea name="text" rows="5" placeholder="Text" id="input-text" class="form-control"></textarea>
                                </div>
                            </div>
                            <div class="text-right">
                                <button type="button" id="button-attribute" class="btn btn-primary">
                                    <i class="fa fa-plus-circle"></i> Add Attribute
                                </button>
                            </div>
                            <br />
                            <div id="product-attribute" class="table-responsive">
                                <table class="table table-bordered table-hover">
                                    <thead>
                                        <tr>
                                            <td class="text-left">Attribute</td>
                                            <td class="text-left">Text</td>
                                            <td class="text-right">Action</td>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${this.generateAttributeRows(productData.product_attribute || [])}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="field-group-section">
                <h4>Downloads & Related Products</h4>
                <div class="quick-edit-field-group" data-field="downloads">
                    <label>Downloads</label>
                    <select name="product_download[]" multiple class="form-control" style="height: 100px;">
                        ${downloads.map(download => `
                            <option value="${download.download_id}" ${(productData.product_download || []).includes(download.download_id) ? 'selected' : ''}>
                                ${this.escapeHtml(download.name)}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="quick-edit-field-group" data-field="related_products">
                    <label>Related Products (Product IDs)</label>
                    <input type="text" name="product_related_input" value="${(productData.product_related || []).join(',')}" class="form-control" placeholder="Enter product IDs separated by commas">
                    <small class="text-muted">Example: 123, 456, 789</small>
                </div>
            </div>
        </div>
    `;
}

generateAttributeRows(attributes) {
    if (!attributes || attributes.length === 0) {
        return '<tr><td colspan="3" class="text-center">No attributes added</td></tr>';
    }

    let html = '';
    attributes.forEach((attribute, index) => {
        html += `
            <tr id="attribute-row-${index}">
                <td class="text-left">
                    ${this.escapeHtml(attribute.name)}
                    <input type="hidden" name="product_attribute[${index}][attribute_id]" value="${attribute.attribute_id}" />
                    <input type="hidden" name="product_attribute[${index}][name]" value="${this.escapeHtml(attribute.name)}" />
                </td>
                <td class="text-left">
                    ${this.escapeHtml(attribute.text)}
                    <input type="hidden" name="product_attribute[${index}][text]" value="${this.escapeHtml(attribute.text)}" />
                </td>
                <td class="text-right">
                    <button type="button" onclick="$('#attribute-row-${index}').remove();" data-toggle="tooltip" title="Remove" class="btn btn-danger">
                        <i class="fa fa-minus-circle"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    return html;
}
generateAttributeOptions(attributeGroups) {
    let options = '';
    
    attributeGroups.forEach(group => {
        options += `<optgroup label="${group.name}">`;
        
        // In a real implementation, you would fetch attributes for this group
        // For now, we'll show a message
        options += `<option value="group-${group.attribute_group_id}" disabled>Load attributes from standard form</option>`;
        
        options += `</optgroup>`;
    });
    
    return options;
}

generateAttributes(productAttributes) {
    if (!productAttributes || productAttributes.length === 0) {
        return `
            <div class="alert alert-info">
                <i class="fa fa-info-circle"></i> No attributes added. Use the "Add Attribute" button above or manage attributes in the standard form.
            </div>
        `;
    }
    
    let html = '';
    
    productAttributes.forEach((attr, index) => {
        html += `
            <div class="attribute-item mb-3 p-3 border rounded">
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Attribute</label>
                            <input type="text" class="form-control" value="${this.escapeHtml(attr.name)}" readonly>
                            <input type="hidden" name="product_attribute[${index}][attribute_id]" value="${attr.attribute_id}">
                            <input type="hidden" name="product_attribute[${index}][name]" value="${this.escapeHtml(attr.name)}">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Text</label>
                            <textarea name="product_attribute[${index}][text]" class="form-control" rows="3" placeholder="Enter attribute text">${this.escapeHtml(attr.text)}</textarea>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group">
                            <label>&nbsp;</label>
                            <button type="button" class="btn btn-danger btn-block remove-attribute" data-index="${index}">
                                <i class="fa fa-trash"></i> Remove
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    return html;
}

addAttribute() {
    const attributeSelect = document.getElementById('attribute-select');
    const selectedValue = attributeSelect.value;
    
    if (!selectedValue) {
        this.showNotification('Please select an attribute first', 'warning');
        return;
    }
    
    this.showNotification('For full attribute management, please use the standard product form', 'info');
    
    // Open standard form in new tab
    if (this.currentProductId) {
        const url = `index.php?route=catalog/product/edit&user_token=${this.getUserToken()}&product_id=${this.currentProductId}`;
        window.open(url, '_blank');
    }
}

generateOptionsTab(productData) {
    return `
        <div class="quick-edit-fields">
            <div class="field-group-section">
                <h4>Product Options</h4>
                <div class="quick-edit-field-group" data-field="options">
                    <div class="panel panel-default">
                        <div class="panel-heading">
                            <h3 class="panel-title">
                                <i class="fa fa-list"></i> Product Options
                            </h3>
                        </div>
                        <div class="panel-body">
                            <div class="form-group">
                                <div class="col-sm-12">
                                    <div class="input-group">
                                        <select id="input-option" class="form-control">
                                            <option value="">-- Select Option --</option>
                                            ${this.generateAllOptionOptions()}
                                        </select>
                                        <span class="input-group-btn">
                                            <button type="button" id="button-option" class="btn btn-primary">
                                                <i class="fa fa-plus-circle"></i> Add Option
                                            </button>
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <br />
                            <div id="option" class="option-table-container">
                                ${this.generateOptionsTable(productData.product_option || [])}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

generateOptionsTable(productOptions) {
    if (!productOptions || productOptions.length === 0) {
        return '<p class="text-center">No options added</p>';
    }

    let html = '';
    productOptions.forEach((option, optionIndex) => {
        html += this.generateOptionRow(option, optionIndex);
    });
    return html;
}

generateOptionRow(option, optionIndex) {
    console.log('Generating option row:', optionIndex, option);
    
    const optionName = option.name || this.getOptionName(option.option_id);
    const optionType = option.type;
    
    return `
        <div class="panel panel-default option-panel" id="option-panel-${optionIndex}">
            <div class="panel-heading">
                <h4 class="panel-title">
                    ${this.escapeHtml(optionName)}
                    <div class="pull-right">
                        <button type="button" class="btn btn-danger btn-xs" onclick="window.quickEditInstance.removeOption(${optionIndex})">
                            <i class="fa fa-minus-circle"></i> Remove
                        </button>
                    </div>
                </h4>
            </div>
            <div class="panel-body">
                <input type="hidden" name="product_option[${optionIndex}][product_option_id]" value="${option.product_option_id || ''}" />
                <input type="hidden" name="product_option[${optionIndex}][option_id]" value="${option.option_id}" />
                <input type="hidden" name="product_option[${optionIndex}][type]" value="${option.type}" />
                <input type="hidden" name="product_option[${optionIndex}][name]" value="${this.escapeHtml(optionName)}" />
                
                <div class="form-group">
                    <label class="col-sm-2 control-label">Required</label>
                    <div class="col-sm-10">
                        <select name="product_option[${optionIndex}][required]" class="form-control">
                            <option value="1" ${option.required == 1 ? 'selected' : ''}>Yes</option>
                            <option value="0" ${option.required == 0 || !option.required ? 'selected' : ''}>No</option>
                        </select>
                    </div>
                </div>
                
                ${this.generateOptionValueFields(option, optionIndex)}
            </div>
        </div>
    `;
}

generateOptionValueFields(option, optionIndex) {
    const optionType = option.type;
    
    if (['select', 'radio', 'checkbox', 'image'].includes(optionType)) {
        return this.generateOptionValueTable(option, optionIndex);
    } else {
        return this.generateSimpleOptionField(option, optionIndex);
    }
}

generateOptionValueTable(option, optionIndex) {
    console.log('Generating value table for option:', optionIndex, 'with values:', option.option_value);
    
    let html = `
        <div class="option-table-container">
            <table id="option-value${optionIndex}" class="table table-striped table-bordered table-hover" style="width: 100%; min-width: 800px;">
                <thead>
                    <tr>
                        <th class="text-left" style="min-width: 150px;">Option Value</th>
                        <th class="text-right" style="min-width: 100px;">Quantity</th>
                        <th class="text-left" style="min-width: 100px;">Subtract</th>
                        <th class="text-right" style="min-width: 150px;">Price</th>
                        <th class="text-right" style="min-width: 150px;">Points</th>
                        <th class="text-right" style="min-width: 150px;">Weight</th>
                        <th style="min-width: 80px;">Action</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (option.option_value && option.option_value.length > 0) {
        option.option_value.forEach((value, valueIndex) => {
            html += this.generateOptionValueRow(option, optionIndex, value, valueIndex);
        });
    } else {
        html += '<tr><td colspan="7" class="text-center">No option values added</td></tr>';
    }
    
    html += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="7" class="text-left">
                            <button type="button" onclick="window.quickEditInstance.addOptionValue(${optionIndex})" class="btn btn-primary btn-sm">
                                <i class="fa fa-plus-circle"></i> Add Option Value
                            </button>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    
    return html;
}

generateOptionValueRow(option, optionIndex, value, valueIndex) {
    const optionValues = this.getOptionValues(option.option_id);
    
    return `
        <tr id="option-value-row-${optionIndex}-${valueIndex}">
            <td class="text-left">
                <select name="product_option[${optionIndex}][product_option_value][${valueIndex}][option_value_id]" class="form-control" style="min-width: 150px;">
                    <option value="">-- Select Option Value --</option>
                    ${optionValues.map(optValue => 
                        `<option value="${optValue.option_value_id}" ${optValue.option_value_id == value.option_value_id ? 'selected' : ''}>
                            ${this.escapeHtml(optValue.name)}
                        </option>`
                    ).join('')}
                </select>
                <input type="hidden" name="product_option[${optionIndex}][product_option_value][${valueIndex}][product_option_value_id]" value="${value.product_option_value_id || ''}" />
            </td>
            <td class="text-right">
                <input type="number" name="product_option[${optionIndex}][product_option_value][${valueIndex}][quantity]" 
                       value="${value.quantity || 0}" placeholder="Quantity" 
                       class="form-control" style="min-width: 80px;" min="0" />
            </td>
            <td class="text-left">
                <select name="product_option[${optionIndex}][product_option_value][${valueIndex}][subtract]" class="form-control" style="min-width: 80px;">
                    <option value="1" ${value.subtract == 1 ? 'selected' : ''}>Yes</option>
                    <option value="0" ${value.subtract == 0 ? 'selected' : ''}>No</option>
                </select>
            </td>
            <td class="text-right">
                <div class="input-group" style="min-width: 150px;">
                    <select name="product_option[${optionIndex}][product_option_value][${valueIndex}][price_prefix]" 
                            class="form-control" style="width: 60px;">
                        <option value="+" ${value.price_prefix == '+' ? 'selected' : ''}>+</option>
                        <option value="-" ${value.price_prefix == '-' ? 'selected' : ''}>-</option>
                    </select>
                    <input type="number" name="product_option[${optionIndex}][product_option_value][${valueIndex}][price]" 
                           value="${value.price || '0.00'}" placeholder="Price" step="0.01"
                           class="form-control" style="width: 90px;" />
                </div>
            </td>
            <td class="text-right">
                <div class="input-group" style="min-width: 150px;">
                    <select name="product_option[${optionIndex}][product_option_value][${valueIndex}][points_prefix]" 
                            class="form-control" style="width: 60px;">
                        <option value="+" ${value.points_prefix == '+' ? 'selected' : ''}>+</option>
                        <option value="-" ${value.points_prefix == '-' ? 'selected' : ''}>-</option>
                    </select>
                    <input type="number" name="product_option[${optionIndex}][product_option_value][${valueIndex}][points]" 
                           value="${value.points || 0}" placeholder="Points" 
                           class="form-control" style="width: 90px;" min="0" />
                </div>
            </td>
            <td class="text-right">
                <div class="input-group" style="min-width: 150px;">
                    <select name="product_option[${optionIndex}][product_option_value][${valueIndex}][weight_prefix]" 
                            class="form-control" style="width: 60px;">
                        <option value="+" ${value.weight_prefix == '+' ? 'selected' : ''}>+</option>
                        <option value="-" ${value.weight_prefix == '-' ? 'selected' : ''}>-</option>
                    </select>
                    <input type="number" name="product_option[${optionIndex}][product_option_value][${valueIndex}][weight]" 
                           value="${value.weight || '0.00'}" placeholder="Weight" step="0.01"
                           class="form-control" style="width: 90px;" />
                </div>
            </td>
            <td class="text-center">
                <button type="button" onclick="$('#option-value-row-${optionIndex}-${valueIndex}').remove();" 
                        class="btn btn-danger btn-sm" title="Remove">
                    <i class="fa fa-times"></i>
                </button>
            </td>
        </tr>
    `;
}

generateSimpleOptionField(option, optionIndex) {
    const optionType = option.type;
    let fieldHtml = '';
    
    switch(optionType) {
        case 'text':
            fieldHtml = `
                <div class="form-group">
                    <label class="col-sm-2 control-label" for="input-value${optionIndex}">Value</label>
                    <div class="col-sm-10">
                        <input type="text" name="product_option[${optionIndex}][value]" value="${option.value || ''}" placeholder="Value" id="input-value${optionIndex}" class="form-control" />
                    </div>
                </div>
            `;
            break;
            
        case 'textarea':
            fieldHtml = `
                <div class="form-group">
                    <label class="col-sm-2 control-label" for="input-value${optionIndex}">Value</label>
                    <div class="col-sm-10">
                        <textarea name="product_option[${optionIndex}][value]" rows="5" placeholder="Value" id="input-value${optionIndex}" class="form-control">${option.value || ''}</textarea>
                    </div>
                </div>
            `;
            break;
            
        case 'file':
            fieldHtml = `
                <div class="form-group">
                    <label class="col-sm-2 control-label" for="input-value${optionIndex}">Value</label>
                    <div class="col-sm-10" style="padding-top: 7px;">
                        <button type="button" id="button-upload${optionIndex}" data-loading-text="Loading..." class="btn btn-default">
                            <i class="fa fa-upload"></i> Upload File
                        </button>
                        <input type="hidden" name="product_option[${optionIndex}][value]" value="${option.value || ''}" id="input-value${optionIndex}" />
                    </div>
                </div>
            `;
            break;
            
        case 'date':
        case 'time':
        case 'datetime':
            fieldHtml = `
                <div class="form-group">
                    <label class="col-sm-2 control-label" for="input-value${optionIndex}">Value</label>
                    <div class="col-sm-3">
                        <div class="input-group date">
                            <input type="text" name="product_option[${optionIndex}][value]" value="${option.value || ''}" placeholder="YYYY-MM-DD" data-date-format="YYYY-MM-DD" id="input-value${optionIndex}" class="form-control" />
                            <span class="input-group-btn">
                                <button type="button" class="btn btn-default"><i class="fa fa-calendar"></i></button>
                            </span>
                        </div>
                    </div>
                </div>
            `;
            break;
    }
    
    return fieldHtml;
}

generateOptionRows(productOptions) {
    if (!productOptions || productOptions.length === 0) {
        return '<tr><td colspan="4" class="text-center">No options added</td></tr>';
    }

    let html = '';
    productOptions.forEach((option, optionIndex) => {
        html += `
            <tr id="option-row-${optionIndex}">
                <td class="text-left">
                    <select name="product_option[${optionIndex}][option_id]" class="form-control" onchange="window.quickEditInstance.optionChanged(${optionIndex})">
                        <option value="">-- Select Option --</option>
                        ${this.generateOptionSelectOptions(option.option_id)}
                    </select>
                    <input type="hidden" name="product_option[${optionIndex}][product_option_id]" value="${option.product_option_id}" />
                    <input type="hidden" name="product_option[${optionIndex}][type]" value="${option.type}" />
                </td>
                <td class="text-left">
                    ${this.generateOptionValueField(option, optionIndex)}
                </td>
                <td class="text-right">
                    <select name="product_option[${optionIndex}][required]" class="form-control">
                        <option value="1" ${option.required == 1 ? 'selected' : ''}>Yes</option>
                        <option value="0" ${option.required == 0 ? 'selected' : ''}>No</option>
                    </select>
                </td>
                <td class="text-right">
                    <button type="button" onclick="$('#option-row-${optionIndex}').remove();" data-toggle="tooltip" title="Remove" class="btn btn-danger">
                        <i class="fa fa-minus-circle"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    return html;
}

generateOptionSelectOptions(selectedOptionId) {
    const options = this.fieldData?.options || [];
    return options.map(option => 
        `<option value="${option.option_id}" ${option.option_id == selectedOptionId ? 'selected' : ''}>${this.escapeHtml(option.name)}</option>`
    ).join('');
}

generateOptionValueField(option, optionIndex) {
    const optionType = option.type;
    
    if (['select', 'radio', 'checkbox'].includes(optionType)) {
        return `
            <div id="option-values-${optionIndex}">
                ${this.generateOptionValueSelect(option, optionIndex)}
            </div>
        `;
    } else if (optionType === 'textarea') {
        return `
            <div id="option-values-${optionIndex}">
                <textarea name="product_option[${optionIndex}][value]" class="form-control">${this.escapeHtml(option.value || '')}</textarea>
            </div>
        `;
    } else {
        return `
            <div id="option-values-${optionIndex}">
                <input type="text" name="product_option[${optionIndex}][value]" value="${this.escapeHtml(option.value || '')}" class="form-control" />
            </div>
        `;
    }
}

generateOptionValueSelect(option, optionIndex) {
    let html = '';
    
    if (option.option_value && option.option_value.length > 0) {
        option.option_value.forEach((value, valueIndex) => {
            html += `
                <div class="input-group" style="margin-bottom: 5px;">
                    <input type="text" class="form-control" value="${this.escapeHtml(value.name)}" readonly />
                    <input type="hidden" name="product_option[${optionIndex}][option_value][${valueIndex}][product_option_value_id]" value="${value.product_option_value_id}" />
                    <input type="hidden" name="product_option[${optionIndex}][option_value][${valueIndex}][option_value_id]" value="${value.option_value_id}" />
                    <div class="input-group-btn">
                        <button type="button" onclick="$(this).parent().parent().remove();" class="btn btn-danger">
                            <i class="fa fa-minus-circle"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    }
    
    html += `
        <div class="input-group">
            <select class="form-control option-value-select" id="option-value-select-${optionIndex}">
                <option value="">-- Select Option Value --</option>
                ${this.generateOptionValueOptions(option.option_id)}
            </select>
            <div class="input-group-btn">
                <button type="button" onclick="window.quickEditInstance.addOptionValue(${optionIndex})" class="btn btn-primary">
                    <i class="fa fa-plus-circle"></i> Add Value
                </button>
            </div>
        </div>
        <div id="option-value-list-${optionIndex}" class="mt-2"></div>
    `;
    
    return html;
}
getOptionName(optionId) {
    const option = this.fieldData?.options?.find(opt => opt.option_id == optionId);
    return option ? option.name : 'Unknown Option';
}

getOptionValues(optionId) {
    const option = this.fieldData?.options?.find(opt => opt.option_id == optionId);
    return option?.values || [];
}

generateAllOptionOptions() {
    const options = this.fieldData?.options || [];
    return options.map(option => 
        `<option value="${option.option_id}" data-type="${option.type}">${this.escapeHtml(option.name)}</option>`
    ).join('');
}

generateOptionValueOptions(optionId) {
    const option = this.fieldData?.options?.find(opt => opt.option_id == optionId);
    if (!option || !option.values) return '';
    
    return option.values.map(value => 
        `<option value="${value.option_value_id}">${this.escapeHtml(value.name)}</option>`
    ).join('');
}

generateOptionOptions() {
    const options = this.fieldData?.options || [];
    return options.map(opt => 
        `<option value="${opt.option_id}">${this.escapeHtml(opt.name)}</option>`
    ).join('');
}

generateProductOptions(productOptions) {
    if (!productOptions || productOptions.length === 0) {
        return `
            <div class="alert alert-info">
                <i class="fa fa-info-circle"></i> No options added. Use the "Add Option" button above to add new options.
            </div>
        `;
    }
    
    let html = '';
    
    productOptions.forEach((option, optionIndex) => {
        const optionType = this.getOptionTypeText(option.type);
        
        html += `
            <div class="option-item mb-4 p-3 border rounded">
                <div class="option-header mb-3">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <h5 class="mb-1">${this.escapeHtml(option.name)}</h5>
                            <small class="text-muted">Type: ${optionType} | Required: ${option.required ? 'Yes' : 'No'}</small>
                        </div>
                        <div class="col-md-4 text-right">
                            <button type="button" class="btn btn-danger btn-sm remove-option" data-index="${optionIndex}">
                                <i class="fa fa-trash"></i> Remove
                            </button>
                        </div>
                    </div>
                </div>
                
                <input type="hidden" name="product_option[${optionIndex}][product_option_id]" value="${option.product_option_id}">
                <input type="hidden" name="product_option[${optionIndex}][option_id]" value="${option.option_id}">
                <input type="hidden" name="product_option[${optionIndex}][required]" value="${option.required}">
                <input type="hidden" name="product_option[${optionIndex}][type]" value="${option.type}">
        `;
        
        // Handle different option types
        if (['select', 'radio', 'checkbox'].includes(option.type) && option.option_value && option.option_value.length > 0) {
            html += this.generateOptionValues(option, optionIndex);
        } else {
            // For text, textarea, file, date, time, datetime
            html += this.generateSimpleOption(option, optionIndex);
        }
        
        html += `</div>`;
    });
    
    return html;
}

generateOptionValues(option, optionIndex) {
    let html = `
        <div class="option-values mt-3">
            <h6>Option Values:</h6>
            <div class="table-responsive">
                <table class="table table-sm table-bordered">
                    <thead>
                        <tr>
                            <th>Option Value</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Price Prefix</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    option.option_value.forEach((value, valueIndex) => {
        html += `
            <tr>
                <td>
                    <input type="text" class="form-control form-control-sm" value="${this.escapeHtml(value.name)}" readonly>
                    <input type="hidden" name="product_option[${optionIndex}][option_value][${valueIndex}][product_option_value_id]" value="${value.product_option_value_id}">
                    <input type="hidden" name="product_option[${optionIndex}][option_value][${valueIndex}][option_value_id]" value="${value.option_value_id}">
                </td>
                <td>
                    <input type="number" name="product_option[${optionIndex}][option_value][${valueIndex}][quantity]" 
                           value="${value.quantity}" class="form-control form-control-sm">
                </td>
                <td>
                    <input type="number" name="product_option[${optionIndex}][option_value][${valueIndex}][price]" 
                           value="${value.price}" step="0.01" class="form-control form-control-sm">
                </td>
                <td>
                    <select name="product_option[${optionIndex}][option_value][${valueIndex}][price_prefix]" class="form-control form-control-sm">
                        <option value="+" ${value.price_prefix === '+' ? 'selected' : ''}>+</option>
                        <option value="-" ${value.price_prefix === '-' ? 'selected' : ''}>-</option>
                    </select>
                </td>
                <td>
                    <button type="button" class="btn btn-danger btn-sm remove-option-value" 
                            data-option-index="${optionIndex}" data-value-index="${valueIndex}">
                        <i class="fa fa-times"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
            <button type="button" class="btn btn-success btn-sm add-option-value" data-option-index="${optionIndex}">
                <i class="fa fa-plus"></i> Add Value
            </button>
        </div>
    `;
    
    return html;
}

generateSimpleOption(option, optionIndex) {
    let html = `
        <div class="simple-option mt-3">
            <div class="form-group">
                <label>Option Value</label>
    `;
    
    if (option.type === 'textarea') {
        html += `
            <textarea name="product_option[${optionIndex}][value]" class="form-control" rows="3">${this.escapeHtml(option.value || '')}</textarea>
        `;
    } else {
        html += `
            <input type="text" name="product_option[${optionIndex}][value]" value="${this.escapeHtml(option.value || '')}" class="form-control">
        `;
    }
    
    html += `</div></div>`;
    return html;
}

addOption() {
    const optionSelect = document.getElementById('option-select');
    const selectedOptionId = optionSelect.value;
    
    if (!selectedOptionId) {
        this.showNotification('Please select an option first', 'warning');
        return;
    }
    
    const selectedOption = this.fieldData?.options?.find(opt => opt.option_id == selectedOptionId);
    if (!selectedOption) {
        this.showNotification('Selected option not found', 'error');
        return;
    }
    
    this.showNotification('For full option management with values, please use the standard product form', 'info');
    
    // Open standard form in new tab
    if (this.currentProductId) {
        const url = `index.php?route=catalog/product/edit&user_token=${this.getUserToken()}&product_id=${this.currentProductId}`;
        window.open(url, '_blank');
    }
}

addOptionValue(optionIndex) {
    const valueSelect = document.getElementById(`option-value-select-${optionIndex}`);
    const valueList = document.getElementById(`option-value-list-${optionIndex}`);
    const selectedValueId = valueSelect.value;
    
    if (!selectedValueId) {
        this.showNotification('Please select an option value', 'warning');
        return;
    }
    
    const selectedOptionId = document.querySelector(`select[name="product_option[${optionIndex}][option_id]"]`).value;
    const selectedOption = this.fieldData?.options?.find(opt => opt.option_id == selectedOptionId);
    const selectedValue = selectedOption?.values?.find(val => val.option_value_id == selectedValueId);
    
    if (!selectedValue) {
        this.showNotification('Selected value not found', 'error');
        return;
    }
    
    const valueCount = valueList.querySelectorAll('.input-group').length;
    
    const valueHtml = `
        <div class="input-group" style="margin-bottom: 5px;">
            <span class="input-group-addon">
                <input type="radio" name="product_option[${optionIndex}][option_value][${valueCount}][default]" value="1" />
            </span>
            <input type="text" class="form-control" value="${this.escapeHtml(selectedValue.name)}" readonly />
            <input type="hidden" name="product_option[${optionIndex}][option_value][${valueCount}][product_option_value_id]" value="" />
            <input type="hidden" name="product_option[${optionIndex}][option_value][${valueCount}][option_value_id]" value="${selectedValue.option_value_id}" />
            <input type="hidden" name="product_option[${optionIndex}][option_value][${valueCount}][name]" value="${this.escapeHtml(selectedValue.name)}" />
            <span class="input-group-addon">
                <input type="text" name="product_option[${optionIndex}][option_value][${valueCount}][quantity]" value="0" placeholder="Qty" class="form-control" style="width: 80px;" />
            </span>
            <span class="input-group-addon">
                <input type="text" name="product_option[${optionIndex}][option_value][${valueCount}][price]" value="0.00" placeholder="Price" class="form-control" style="width: 100px;" />
            </span>
            <span class="input-group-addon">
                <select name="product_option[${optionIndex}][option_value][${valueCount}][price_prefix]" class="form-control">
                    <option value="+">+</option>
                    <option value="-">-</option>
                </select>
            </span>
            <div class="input-group-btn">
                <button type="button" onclick="$(this).parent().parent().remove();" class="btn btn-danger">
                    <i class="fa fa-minus-circle"></i>
                </button>
            </div>
        </div>
    `;
    
    valueList.insertAdjacentHTML('beforeend', valueHtml);
    valueSelect.value = '';
    
    this.showNotification('Option value added', 'success');
}

removeOptionValue(optionIndex, valueIndex) {
    const valueRow = document.querySelector(`[data-option-index="${optionIndex}"][data-value-index="${valueIndex}"]`);
    if (valueRow) {
        valueRow.closest('tr').remove();
        this.showNotification('Option value removed', 'success');
    }
}

    generateLanguageFields(descriptions) {
        const languages = this.fieldData?.languages || [];
        if (languages.length === 0) return '';

        let html = `
            <div class="language-tabs">
                <div class="language-tab-buttons">
        `;

        languages.forEach((lang, index) => {
            const isActive = index === 0 ? 'active' : '';
            const langData = descriptions && descriptions[lang.language_id] ? descriptions[lang.language_id] : {};
            html += `<button type="button" class="language-tab-button ${isActive}" data-language="${lang.language_id}">
                        <img src="language/${lang.code}/${lang.code}.png" alt="${lang.name}" title="${lang.name}" /> ${lang.name}
                    </button>`;
        });

        html += `</div>`;

        languages.forEach((lang, index) => {
            const isActive = index === 0 ? 'active' : '';
            const langData = descriptions && descriptions[lang.language_id] ? descriptions[lang.language_id] : {};
            
            html += `
                <div class="language-tab-content ${isActive}" data-language="${lang.language_id}">
                    <div class="quick-edit-field-group" data-field="name_${lang.language_id}">
                        <label for="field_name_${lang.language_id}">${this.getFieldLabel('name')}</label>
                        <input type="text" id="field_name_${lang.language_id}" name="product_description[${lang.language_id}][name]" value="${this.escapeHtml(langData.name || '')}" class="form-control">
                    </div>
                    <div class="quick-edit-field-group" data-field="description_${lang.language_id}">
                        <label for="field_description_${lang.language_id}">${this.getFieldLabel('description')}</label>
                        <textarea id="field_description_${lang.language_id}" name="product_description[${lang.language_id}][description]" class="form-control" rows="4">${this.escapeHtml(langData.description || '')}</textarea>
                    </div>
                    <div class="quick-edit-field-group" data-field="meta_title_${lang.language_id}">
                        <label for="field_meta_title_${lang.language_id}">${this.getFieldLabel('meta_title')}</label>
                        <input type="text" id="field_meta_title_${lang.language_id}" name="product_description[${lang.language_id}][meta_title]" value="${this.escapeHtml(langData.meta_title || '')}" class="form-control">
                    </div>
                    <div class="quick-edit-field-group" data-field="meta_description_${lang.language_id}">
                        <label for="field_meta_description_${lang.language_id}">${this.getFieldLabel('meta_description')}</label>
                        <textarea id="field_meta_description_${lang.language_id}" name="product_description[${lang.language_id}][meta_description]" class="form-control" rows="2">${this.escapeHtml(langData.meta_description || '')}</textarea>
                    </div>
                    <div class="quick-edit-field-group" data-field="meta_keyword_${lang.language_id}">
                        <label for="field_meta_keyword_${lang.language_id}">${this.getFieldLabel('meta_keyword')}</label>
                        <textarea id="field_meta_keyword_${lang.language_id}" name="product_description[${lang.language_id}][meta_keyword]" class="form-control" rows="2">${this.escapeHtml(langData.meta_keyword || '')}</textarea>
                    </div>
                    <div class="quick-edit-field-group" data-field="tag_${lang.language_id}">
                        <label for="field_tag_${lang.language_id}">${this.getFieldLabel('tag')}</label>
                        <input type="text" id="field_tag_${lang.language_id}" name="product_description[${lang.language_id}][tag]" value="${this.escapeHtml(langData.tag || '')}" class="form-control">
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        return html;
    }

    generateAdditionalImages(images) {
        if (!images || images.length === 0) {
            return '<p class="text-muted">No additional images</p>';
        }
        
        return images.map((image, index) => `
            <div class="additional-image-item mb-2">
                <div class="row">
                    <div class="col-md-8">
                        <div class="input-group">
                            <input type="text" name="product_image[${index}][image]" value="${this.escapeHtml(image.image)}" class="form-control" placeholder="Image URL">
                            <div class="input-group-append">
<button type="button" class="btn btn-default open-image-manager" data-target="additional-image-${index}" data-preview="additional-preview-${index}">
    <i class="fa fa-folder-open"></i> Select
</button>
                            </div>
                        </div>
                        <div class="image-preview mt-1" id="additional-preview-${index}" style="max-width: 100px; max-height: 100px;">
                            ${image.image ? `<img src="${this.escapeHtml(image.image)}" style="max-width: 100%; max-height: 100%;" />` : ''}
                        </div>
                        <input type="hidden" id="additional-image-${index}" value="${this.escapeHtml(image.image)}">
                    </div>
                    <div class="col-md-2">
                        <input type="number" name="product_image[${index}][sort_order]" value="${this.escapeHtml(image.sort_order || 0)}" class="form-control" placeholder="Sort">
                    </div>
                    <div class="col-md-2">
                        <button type="button" class="btn btn-danger btn-sm remove-additional-image" data-index="${index}">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    generateFilterGroups(filters, selectedFilters) {
        const groups = {};
        
        // Group filters by their group
        filters.forEach(filter => {
            if (!groups[filter.group]) {
                groups[filter.group] = [];
            }
            groups[filter.group].push(filter);
        });
        
        let html = '';
        Object.keys(groups).forEach(groupName => {
            html += `<div class="filter-group mb-3"><strong>${groupName}</strong>`;
            groups[groupName].forEach(filter => {
                const isChecked = selectedFilters.includes(filter.filter_id);
                html += `
                    <div class="checkbox">
                        <label>
                            <input type="checkbox" name="product_filter[]" value="${filter.filter_id}" ${isChecked ? 'checked' : ''}>
                            ${filter.name}
                        </label>
                    </div>
                `;
            });
            html += '</div>';
        });
        
        return html;
    }

generateAttributes(attributeGroups, productAttributes) {
    let html = '';
    
    if (!productAttributes || productAttributes.length === 0) {
        html = `
            <div class="alert alert-info">
                <i class="fa fa-info-circle"></i> No attributes added. Use the standard product form to manage attributes.
            </div>
            <div class="text-center">
                <button type="button" class="btn btn-default" onclick="window.open('index.php?route=catalog/product/edit&user_token=${this.getUserToken()}&product_id=${this.currentProductId}', '_blank')">
                    <i class="fa fa-external-link"></i> Open Standard Form for Attributes
                </button>
            </div>
        `;
    } else {
        let attributeIndex = 0;
        
        attributeGroups.forEach(group => {
            const groupAttributes = productAttributes.filter(attr => 
                attr.attribute_group_id == group.attribute_group_id
            );
            
            if (groupAttributes.length > 0) {
                html += `<div class="attribute-group mb-4 p-3 border rounded">`;
                html += `<h5 class="mb-3">${group.name}</h5>`;
                
                groupAttributes.forEach(attr => {
                    html += `
                        <div class="attribute-item mb-3 p-2 border" data-field="attribute_${attr.attribute_id}">
                            <div class="row">
                                <div class="col-md-4">
                                    <label class="font-weight-bold">${this.escapeHtml(attr.name)}</label>
                                    <input type="hidden" name="product_attribute[${attributeIndex}][attribute_id]" value="${attr.attribute_id}">
                                    <input type="hidden" name="product_attribute[${attributeIndex}][name]" value="${this.escapeHtml(attr.name)}">
                                </div>
                                <div class="col-md-6">
                                    <textarea name="product_attribute[${attributeIndex}][text]" class="form-control" rows="2" placeholder="Enter attribute value">${this.escapeHtml(attr.text)}</textarea>
                                </div>
                                <div class="col-md-2">
                                    <div class="form-group">
                                        <label>Language</label>
                                        <select name="product_attribute[${attributeIndex}][language_id]" class="form-control">
                                            ${(this.fieldData?.languages || []).map(lang => 
                                                `<option value="${lang.language_id}" ${lang.language_id == attr.language_id ? 'selected' : ''}>${lang.name}</option>`
                                            ).join('')}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    attributeIndex++;
                });
                
                html += `</div>`;
            }
        });
    }
    
    return html;
}

    generateProductOptions(options, productOptions) {
        if (!productOptions || productOptions.length === 0) {
            return '<p class="text-muted">No options added</p>';
        }
        
        let html = '';
        productOptions.forEach((option, optionIndex) => {
            html += `
                <div class="option-item mb-4 p-3 border rounded">
                    <div class="row mb-2">
                        <div class="col-md-6">
                            <label>Option</label>
                            <select name="product_option[${optionIndex}][option_id]" class="form-control">
                                ${options.map(opt => 
                                    `<option value="${opt.option_id}" ${opt.option_id == option.option_id ? 'selected' : ''}>${this.escapeHtml(opt.name)}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label>Required</label>
                            <select name="product_option[${optionIndex}][required]" class="form-control">
                                <option value="1" ${option.required == 1 ? 'selected' : ''}>Yes</option>
                                <option value="0" ${option.required == 0 ? 'selected' : ''}>No</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label>&nbsp;</label>
                            <button type="button" class="btn btn-danger btn-sm btn-block remove-option" data-index="${optionIndex}">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </div>
            `;
            
            // Option values
            if (option.option_value && option.option_value.length > 0) {
                html += `<div class="option-values mt-2"><strong>Values:</strong>`;
                option.option_value.forEach((value, valueIndex) => {
                    html += `
                        <div class="row mb-1">
                            <div class="col-md-3">
                                <input type="text" name="product_option[${optionIndex}][option_value][${valueIndex}][quantity]" value="${this.escapeHtml(value.quantity)}" class="form-control" placeholder="Qty">
                            </div>
                            <div class="col-md-3">
                                <input type="number" name="product_option[${optionIndex}][option_value][${valueIndex}][price]" value="${this.escapeHtml(value.price)}" step="0.01" class="form-control" placeholder="Price">
                            </div>
                            <div class="col-md-3">
                                <select name="product_option[${optionIndex}][option_value][${valueIndex}][price_prefix]" class="form-control">
                                    <option value="+" ${value.price_prefix == '+' ? 'selected' : ''}>+</option>
                                    <option value="-" ${value.price_prefix == '-' ? 'selected' : ''}>-</option>
                                </select>
                            </div>
                            <div class="col-md-3">
                                <input type="hidden" name="product_option[${optionIndex}][option_value][${valueIndex}][option_value_id]" value="${value.option_value_id}">
                                <input type="hidden" name="product_option[${optionIndex}][option_value][${valueIndex}][product_option_value_id]" value="${value.product_option_value_id}">
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }
            
            html += '</div>';
        });
        
        return html;
    }

    generateVisibilityCheckboxes() {
        const allFields = this.getAllFieldKeys();
        let html = '';

        allFields.forEach(fieldKey => {
            const isChecked = this.visibleFields.includes(fieldKey);
            const label = this.getFieldLabel(fieldKey);
            
            html += `
                <div class="visibility-checkbox">
                    <input type="checkbox" id="vis_${fieldKey}" ${isChecked ? 'checked' : ''} data-field="${fieldKey}">
                    <label for="vis_${fieldKey}">${label}</label>
                </div>
            `;
        });

        return html;
    }

setupModalHandlers(modal, productData) {
    // Save button
    const saveBtn = modal.querySelector('.save-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
        if (this.isNewProduct) {
            this.createProduct();
        } else {
            this.saveProduct(productData.product_id);
        }
    });

    // Close button
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => {
        this.closeModal();
    });

    // Field visibility
    const visibilityBtn = modal.querySelector('.field-visibility-btn');
    if (visibilityBtn) visibilityBtn.addEventListener('click', () => {
        this.toggleFieldVisibilityControls();
    });

    // Fullscreen toggle
    const fullscreenBtn = modal.querySelector('.fullscreen-btn');
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => {
        this.toggleFullscreen();
    });

    // Tab buttons
    modal.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            this.switchTab(tabName, modal);
        });
    });

    // Language tabs
    modal.querySelectorAll('.language-tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const languageId = button.getAttribute('data-language');
            this.switchLanguageTab(languageId, modal);
        });
    });

    // Close visibility controls
    const closeVisibility = modal.querySelector('.close-visibility');
    if (closeVisibility) {
        closeVisibility.addEventListener('click', () => {
            this.toggleFieldVisibilityControls();
        });
    }

    // Visibility checkboxes
    modal.querySelectorAll('#visibility-checkboxes input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const fieldKey = e.target.getAttribute('data-field');
            this.toggleFieldVisibilityState(fieldKey, e.target.checked);
        });
    });

    // Image manager buttons
    modal.querySelectorAll('.open-image-manager').forEach(button => {
        button.addEventListener('click', (e) => {
            const target = button.getAttribute('data-target');
            const preview = button.getAttribute('data-preview');
            this.openImageManager(target, preview);
        });
    });

    // Additional images buttons
    const addImageBtn = modal.querySelector('.add-additional-image');
    if (addImageBtn) addImageBtn.addEventListener('click', () => {
        this.addAdditionalImage();
    });

    modal.querySelectorAll('.remove-additional-image').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = button.getAttribute('data-index');
            this.removeAdditionalImage(index);
        });
    });

    // Attribute management
    const addAttributeBtn = modal.querySelector('.add-attribute');
    if (addAttributeBtn) addAttributeBtn.addEventListener('click', () => {
        this.addAttribute();
    });

    modal.querySelectorAll('.remove-attribute').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = button.getAttribute('data-index');
            this.removeAttribute(index);
        });
    });

// Option button handler
setTimeout(() => {
    const addOptionBtn = document.getElementById('button-option');
    if (addOptionBtn) {
        addOptionBtn.addEventListener('click', () => {
            this.addOptionFromSelector();
        });
    }
}, 100);

    modal.querySelectorAll('.remove-option').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = button.getAttribute('data-index');
            this.removeOption(index);
        });
    });

    // Bind option type change handlers
    modal.querySelectorAll('.option-type-select').forEach(select => {
        select.addEventListener('change', (e) => {
            this.handleOptionTypeChange(e.target);
        });
    });

    // Bind add option value handlers
    modal.querySelectorAll('.add-option-value').forEach(button => {
        button.addEventListener('click', (e) => {
            const optionIndex = button.getAttribute('data-option-index');
            this.addOptionValue(optionIndex);
        });
    });
    // Attribute autocomplete setup
setTimeout(() => {
    this.setupAttributeAutocomplete();
}, 100);
}

    switchTab(tabName, modal) {
        // Update tab buttons
        modal.querySelectorAll('.tab-button').forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-tab') === tabName);
        });

        // Update tab contents
        modal.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.getAttribute('data-tab') === tabName);
        });
    }

    switchLanguageTab(languageId, modal) {
        modal.querySelectorAll('.language-tab-button').forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-language') === languageId);
        });

        modal.querySelectorAll('.language-tab-content').forEach(content => {
            content.classList.toggle('active', content.getAttribute('data-language') === languageId);
        });
    }

    // Image Manager Integration
openImageManager(target, preview) {
    console.log('Opening image manager for:', target, preview);
    
    // Store the callback information for later use
    this.currentImageTarget = target;
    this.currentImagePreview = preview;
    
    // Create and trigger the file manager
    const triggerElement = document.createElement('div');
    triggerElement.id = 'trigger-' + target;
    document.body.appendChild(triggerElement);
    
    // Use OpenCart's file manager
    $('#trigger-' + target).trigger('click');
    
    // Set up the file manager callback
    this.setupFileManagerCallback(target, preview);
}

setupFileManagerCallback(target, preview) {
    // Override the file manager callback function
    window['quickEditImageCallback'] = (file) => {
        console.log('File selected from manager:', file);
        
        if (file) {
            // Update the input field
            const input = document.getElementById(target);
            if (input) {
                input.value = file;
            }
            
            // Update the preview
            const previewElement = document.getElementById(preview);
            if (previewElement) {
                if (previewElement.tagName === 'IMG') {
                    previewElement.src = file;
                } else {
                    previewElement.innerHTML = `<img src="${file}" style="max-width: 100%; max-height: 100%;" />`;
                }
            }
            
            this.showNotification('Image selected successfully', 'success');
        }
        
        // Clean up
        const triggerElement = document.getElementById('trigger-' + target);
        if (triggerElement) {
            triggerElement.remove();
        }
    };
}

    addAdditionalImage() {
        const container = document.getElementById('additional-images-container');
        const index = container.querySelectorAll('.additional-image-item').length;
        
        const html = `
            <div class="additional-image-item mb-2">
                <div class="row">
                    <div class="col-md-8">
                        <div class="input-group">
                            <input type="text" name="product_image[${index}][image]" value="" class="form-control" placeholder="Image URL">
                            <div class="input-group-append">
                                <button type="button" class="btn btn-default open-image-manager" data-target="additional-image-${index}" data-preview="additional-preview-${index}">
                                    <i class="fa fa-folder-open"></i>
                                </button>
                            </div>
                        </div>
                        <div class="image-preview mt-1" id="additional-preview-${index}" style="max-width: 100px; max-height: 100px;"></div>
                        <input type="hidden" id="additional-image-${index}" value="">
                    </div>
                    <div class="col-md-2">
                        <input type="number" name="product_image[${index}][sort_order]" value="0" class="form-control" placeholder="Sort">
                    </div>
                    <div class="col-md-2">
                        <button type="button" class="btn btn-danger btn-sm remove-additional-image" data-index="${index}">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', html);
        
        // Add event listener to the new remove button
        const newButton = container.querySelector(`.remove-additional-image[data-index="${index}"]`);
        newButton.addEventListener('click', () => {
            this.removeAdditionalImage(index);
        });
        
        // Add event listener to the new image manager button
        const imageButton = container.querySelector(`.open-image-manager[data-target="additional-image-${index}"]`);
        imageButton.addEventListener('click', (e) => {
            const target = imageButton.getAttribute('data-target');
            const preview = imageButton.getAttribute('data-preview');
            this.openImageManager(target, preview);
        });
    }

    removeAdditionalImage(index) {
        const item = document.querySelector(`.additional-image-item:nth-child(${parseInt(index) + 1})`);
        if (item) {
            item.remove();
            // Reindex remaining items
            this.reindexAdditionalImages();
        }
    }

    reindexAdditionalImages() {
        const container = document.getElementById('additional-images-container');
        const items = container.querySelectorAll('.additional-image-item');
        
        items.forEach((item, newIndex) => {
            // Update all inputs and buttons within this item
            const inputs = item.querySelectorAll('input, button');
            inputs.forEach(element => {
                if (element.name) {
                    element.name = element.name.replace(/product_image\[\d+\]/, `product_image[${newIndex}]`);
                }
                if (element.classList.contains('remove-additional-image')) {
                    element.setAttribute('data-index', newIndex);
                }
                if (element.id && element.id.includes('additional-image-')) {
                    element.id = `additional-image-${newIndex}`;
                }
                if (element.id && element.id.includes('additional-preview-')) {
                    element.id = `additional-preview-${newIndex}`;
                }
            });
            
            // Update image manager button data attributes
            const imageButton = item.querySelector('.open-image-manager');
            if (imageButton) {
                imageButton.setAttribute('data-target', `additional-image-${newIndex}`);
                imageButton.setAttribute('data-preview', `additional-preview-${newIndex}`);
            }
        });
    }

// Attribute methods
setupAttributeAutocomplete() {
    // This would set up attribute autocomplete like in the original form
    console.log('Setting up attribute autocomplete');
    
    const attributeInput = document.getElementById('input-attribute');
    if (attributeInput) {
        attributeInput.addEventListener('input', (e) => {
            this.searchAttributes(e.target.value);
        });
    }
    
    const addAttributeBtn = document.getElementById('button-attribute');
    if (addAttributeBtn) {
        addAttributeBtn.addEventListener('click', () => {
            this.addAttribute();
        });
    }
}

searchAttributes(attributeName) {
    // Simulate attribute search
    if (attributeName.length < 2) return;
    
    console.log('Searching for attributes:', attributeName);
    // In a real implementation, this would make an AJAX call to search attributes
}

addAttribute() {
    const attributeInput = document.getElementById('input-attribute');
    const attributeIdInput = document.querySelector('input[name="attribute_id"]');
    const textInput = document.getElementById('input-text');
    
    const attributeName = attributeInput.value;
    const attributeId = attributeIdInput.value;
    const text = textInput.value;
    
    if (!attributeId) {
        this.showNotification('Please select an attribute from the dropdown', 'warning');
        return;
    }
    
    if (!text) {
        this.showNotification('Please enter attribute text', 'warning');
        return;
    }
    
    const attributeTable = document.querySelector('#product-attribute tbody');
    const rowCount = attributeTable.querySelectorAll('tr').length - 1; // Subtract the "no attributes" row if present
    
    const newRow = document.createElement('tr');
    newRow.id = `attribute-row-${rowCount}`;
    newRow.innerHTML = `
        <td class="text-left">
            ${this.escapeHtml(attributeName)}
            <input type="hidden" name="product_attribute[${rowCount}][attribute_id]" value="${attributeId}" />
            <input type="hidden" name="product_attribute[${rowCount}][name]" value="${this.escapeHtml(attributeName)}" />
        </td>
        <td class="text-left">
            ${this.escapeHtml(text)}
            <input type="hidden" name="product_attribute[${rowCount}][text]" value="${this.escapeHtml(text)}" />
        </td>
        <td class="text-right">
            <button type="button" onclick="$('#attribute-row-${rowCount}').remove();" data-toggle="tooltip" title="Remove" class="btn btn-danger">
                <i class="fa fa-minus-circle"></i>
            </button>
        </td>
    `;
    
    // Remove "no attributes" row if it exists
    const noAttributesRow = attributeTable.querySelector('tr:first-child');
    if (noAttributesRow && noAttributesRow.textContent.includes('No attributes')) {
        noAttributesRow.remove();
    }
    
    attributeTable.appendChild(newRow);
    
    // Clear inputs
    attributeInput.value = '';
    attributeIdInput.value = '';
    textInput.value = '';
    
    this.showNotification('Attribute added successfully', 'success');
}

// Option methods
addOptionRow() {
    const optionTable = document.querySelector('.table tbody');
    const rowCount = optionTable.querySelectorAll('tr').length - 1; // Subtract the "no options" row if present
    
    const newRow = document.createElement('tr');
    newRow.id = `option-row-${rowCount}`;
    newRow.innerHTML = `
        <td class="text-left">
            <select name="product_option[${rowCount}][option_id]" class="form-control" onchange="quickEditInstance.optionChanged(${rowCount})">
                <option value="">-- Select Option --</option>
                ${this.generateOptionSelectOptions('')}
            </select>
            <input type="hidden" name="product_option[${rowCount}][product_option_id]" value="" />
            <input type="hidden" name="product_option[${rowCount}][type]" value="" />
        </td>
        <td class="text-left">
            <div id="option-values-${rowCount}">
                <em>Select an option first</em>
            </div>
        </td>
        <td class="text-right">
            <select name="product_option[${rowCount}][required]" class="form-control">
                <option value="1">Yes</option>
                <option value="0" selected>No</option>
            </select>
        </td>
        <td class="text-right">
            <button type="button" onclick="$('#option-row-${rowCount}').remove();" data-toggle="tooltip" title="Remove" class="btn btn-danger">
                <i class="fa fa-minus-circle"></i>
            </button>
        </td>
    `;
    
    // Remove "no options" row if it exists
    const noOptionsRow = optionTable.querySelector('tr:first-child');
    if (noOptionsRow && noOptionsRow.textContent.includes('No options')) {
        noOptionsRow.remove();
    }
    
    optionTable.appendChild(newRow);
}

optionChanged(optionIndex) {
    const optionSelect = document.querySelector(`select[name="product_option[${optionIndex}][option_id]"]`);
    const typeInput = document.querySelector(`input[name="product_option[${optionIndex}][type]"]`);
    let optionValuesContainer = document.getElementById(`option-values-${optionIndex}`);
    
    if (!optionValuesContainer) {
        console.error('Option values container not found for index:', optionIndex);
        return;
    }
    
    const selectedOptionId = optionSelect.value;
    const selectedOption = this.fieldData?.options?.find(opt => opt.option_id == selectedOptionId);
    
    if (selectedOption) {
        if (typeInput) {
            typeInput.value = selectedOption.type;
        }
        
        if (['select', 'radio', 'checkbox'].includes(selectedOption.type)) {
            optionValuesContainer.innerHTML = `
                <div class="input-group">
                    <select class="form-control option-value-select" id="option-value-select-${optionIndex}">
                        <option value="">-- Select Option Value --</option>
                        ${this.generateOptionValueOptions(selectedOptionId)}
                    </select>
                    <div class="input-group-btn">
                        <button type="button" onclick="window.quickEditInstance.addOptionValue(${optionIndex})" class="btn btn-primary">
                            <i class="fa fa-plus-circle"></i> Add Value
                        </button>
                    </div>
                </div>
                <div id="option-value-list-${optionIndex}" class="mt-2"></div>
            `;
        } else {
            let inputField = '';
            if (selectedOption.type === 'textarea') {
                inputField = `<textarea name="product_option[${optionIndex}][value]" class="form-control" rows="3"></textarea>`;
            } else {
                inputField = `<input type="text" name="product_option[${optionIndex}][value]" class="form-control" />`;
            }
            optionValuesContainer.innerHTML = inputField;
        }
    } else {
        optionValuesContainer.innerHTML = '<em>Select an option first</em>';
    }
}



    addOption() {
        const container = document.getElementById('options-container');
        const index = container.querySelectorAll('.option-item').length;
        const options = this.fieldData?.options || [];
        
        const html = `
            <div class="option-item mb-4 p-3 border rounded">
                <div class="row mb-2">
                    <div class="col-md-6">
                        <label>Option</label>
                        <select name="product_option[${index}][option_id]" class="form-control">
                            <option value="">Select Option</option>
                            ${options.map(opt => 
                                `<option value="${opt.option_id}">${this.escapeHtml(opt.name)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="col-md-4">
                        <label>Required</label>
                        <select name="product_option[${index}][required]" class="form-control">
                            <option value="1">Yes</option>
                            <option value="0" selected>No</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <label>&nbsp;</label>
                        <button type="button" class="btn btn-danger btn-sm btn-block remove-option" data-index="${index}">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="option-values mt-2">
                    <strong>Values:</strong>
                    <div class="row mb-1">
                        <div class="col-md-3">
                            <input type="text" name="product_option[${index}][option_value][0][quantity]" value="1" class="form-control" placeholder="Qty">
                        </div>
                        <div class="col-md-3">
                            <input type="number" name="product_option[${index}][option_value][0][price]" value="0" step="0.01" class="form-control" placeholder="Price">
                        </div>
                        <div class="col-md-3">
                            <select name="product_option[${index}][option_value][0][price_prefix]" class="form-control">
                                <option value="+">+</option>
                                <option value="-">-</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <input type="hidden" name="product_option[${index}][option_value][0][option_value_id]" value="">
                            <input type="hidden" name="product_option[${index}][option_value][0][product_option_value_id]" value="">
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', html);
        
        // Add event listener to the new remove button
        const newButton = container.querySelector(`.remove-option[data-index="${index}"]`);
        newButton.addEventListener('click', () => {
            this.removeOption(index);
        });
    }

getOptionTypeText(type) {
    const types = {
        'select': 'Dropdown',
        'radio': 'Radio',
        'checkbox': 'Checkbox',
        'text': 'Text',
        'textarea': 'Textarea',
        'file': 'File',
        'date': 'Date',
        'time': 'Time',
        'datetime': 'Date & Time'
    };
    return types[type] || type;
}

removeAttribute(index) {
    const attributeItem = document.querySelector(`.attribute-item:nth-child(${parseInt(index) + 1})`);
    if (attributeItem) {
        attributeItem.remove();
        this.showNotification('Attribute removed', 'success');
        this.reindexAttributes();
    }
}


reindexAttributes() {
    const container = document.getElementById('attributes-container');
    const items = container.querySelectorAll('.attribute-item');
    
    items.forEach((item, newIndex) => {
        const inputs = item.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            if (input.name) {
                input.name = input.name.replace(/product_attribute\[\d+\]/, `product_attribute[${newIndex}]`);
            }
        });
        
        const removeBtn = item.querySelector('.remove-attribute');
        if (removeBtn) {
            removeBtn.setAttribute('data-index', newIndex);
        }
    });
}

// Add option from selector
addOptionFromSelector() {
    const optionSelect = document.getElementById('input-option');
    const selectedOptionId = optionSelect.value;
    
    if (!selectedOptionId) {
        this.showNotification('Please select an option', 'warning');
        return;
    }
    
    const selectedOption = this.fieldData?.options?.find(opt => opt.option_id == selectedOptionId);
    if (!selectedOption) {
        this.showNotification('Selected option not found', 'error');
        return;
    }
    
    // Get current option count
    const optionContainer = document.getElementById('option');
    const currentOptions = optionContainer.querySelectorAll('.option');
    const optionIndex = currentOptions.length;
    
    // Create new option row
    const newOption = {
        option_id: selectedOptionId,
        type: selectedOption.type,
        required: 0,
        value: '',
        option_value: []
    };
    
    const optionHtml = this.generateOptionRow(newOption, optionIndex);
    
    // Remove "no options" message if it exists
    const noOptionsMsg = optionContainer.querySelector('p.text-center');
    if (noOptionsMsg) {
        noOptionsMsg.remove();
    }
    
    optionContainer.insertAdjacentHTML('beforeend', optionHtml);
    optionSelect.value = '';
    
    this.showNotification('Option added successfully', 'success');
}

// Add option value row
addOptionValue(optionIndex) {
    const optionTable = document.getElementById(`option-value${optionIndex}`);
    if (!optionTable) {
        this.showNotification('Option table not found', 'error');
        return;
    }
    
    const optionId = document.querySelector(`input[name="product_option[${optionIndex}][option_id]"]`).value;
    const valueIndex = optionTable.querySelectorAll('tbody tr').length;
    
    const newValueRow = this.generateOptionValueRow(
        { option_id: optionId, option_value: [] },
        optionIndex,
        { 
            product_option_value_id: '',
            option_value_id: '',
            quantity: 0,
            subtract: 1,
            price: '0.0000',
            price_prefix: '+',
            points: 0,
            points_prefix: '+',
            weight: '0.00',
            weight_prefix: '+'
        },
        valueIndex
    );
    
    optionTable.querySelector('tbody').insertAdjacentHTML('beforeend', newValueRow);
}

// Remove option
removeOption(optionIndex) {
    const optionElement = document.getElementById(`option-row-${optionIndex}`);
    if (optionElement) {
        optionElement.remove();
        this.showNotification('Option removed', 'success');
        this.reindexOptions();
    }
}

// Reindex options after removal
reindexOptions() {
    const optionContainer = document.getElementById('option');
    const options = optionContainer.querySelectorAll('.option');
    
    if (options.length === 0) {
        optionContainer.innerHTML = '<p class="text-center">No options added</p>';
        return;
    }
    
    options.forEach((optionElement, newIndex) => {
        // Update all inputs within this option
        const inputs = optionElement.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.name) {
                input.name = input.name.replace(/product_option\[\d+\]/, `product_option[${newIndex}]`);
            }
        });
        
        // Update option value table ID
        const optionTable = optionElement.querySelector('table[id^="option-value"]');
        if (optionTable) {
            optionTable.id = `option-value${newIndex}`;
        }
        
        // Update remove button onclick
        const removeBtn = optionElement.querySelector('button[onclick*="removeOption"]');
        if (removeBtn) {
            removeBtn.setAttribute('onclick', `window.quickEditInstance.removeOption(${newIndex})`);
        }
        
        // Update add option value button onclick
        const addValueBtn = optionElement.querySelector('button[onclick*="addOptionValue"]');
        if (addValueBtn) {
            addValueBtn.setAttribute('onclick', `window.quickEditInstance.addOptionValue(${newIndex})`);
        }
        
        // Update option value row IDs and remove buttons
        const valueRows = optionElement.querySelectorAll('tr[id^="option-value-row-"]');
        valueRows.forEach((row, valueIndex) => {
            row.id = `option-value-row-${newIndex}-${valueIndex}`;
            const removeValueBtn = row.querySelector('button[onclick*="remove"]');
            if (removeValueBtn) {
                removeValueBtn.setAttribute('onclick', `$('#option-value-row-${newIndex}-${valueIndex}').remove()`);
            }
        });
    });
}

async saveProduct(productId) {
    if (this.isLoading) return;

    const form = document.querySelector('.quick-edit-form');
    if (!form) return;

    this.showLoading();

    try {
        // Create proper form data
        const formData = new FormData();
                // САМО най-важните полета за тест
        formData.append('name', document.getElementById('field_name')?.value || 'TEST_NAME');        
        formData.append('model', document.getElementById('field_model')?.value || 'TEST_MODEL');
        formData.append('price', document.getElementById('field_price')?.value || '0');
        formData.append('quantity', document.getElementById('field_quantity')?.value || '0');
        formData.append('status', document.getElementById('field_status')?.value || '1');
        
        // Описания - задължително
        const nameInput = document.querySelector('input[name*="[name]"]');
        if (nameInput) {
            const languageId = nameInput.name.match(/\[(\d+)\]/)[1];
            formData.append(`product_description[${languageId}][name]`, nameInput.value || 'Test Product');
        }
        // Process all form elements
        const formElements = form.querySelectorAll('input, select, textarea');
        
        formElements.forEach(element => {
            if (element.name && element.name !== 'product_related_input') {
                if (element.type === 'checkbox') {
                    if (element.checked) {
                        if (element.name.endsWith('[]')) {
                            formData.append(element.name, element.value);
                        } else {
                            formData.append(element.name, '1');
                        }
                    } else {
                        if (!element.name.endsWith('[]')) {
                            formData.append(element.name, '0');
                        }
                    }
                } else if (element.type === 'radio') {
                    if (element.checked) {
                        formData.append(element.name, element.value);
                    }
                } else if (element.type === 'select-multiple') {
                    Array.from(element.selectedOptions).forEach(option => {
                        formData.append(element.name, option.value);
                    });
                } else {
                    formData.append(element.name, element.value);
                }
            }
        });

        // Process special price
        const specialPriceInput = document.getElementById('field_special_price');
        if (specialPriceInput && specialPriceInput.value) {
            const today = new Date().toISOString().split('T')[0];
            formData.append('product_special[0][price]', specialPriceInput.value);
            formData.append('product_special[0][priority]', '1');
            formData.append('product_special[0][date_start]', today);
            formData.append('product_special[0][date_end]', '');
        }

        // Process related products
        const relatedInput = document.querySelector('input[name="product_related_input"]');
        if (relatedInput && relatedInput.value) {
            const relatedIds = relatedInput.value.split(',').map(id => id.trim()).filter(id => id);
            relatedIds.forEach(id => {
                formData.append('product_related[]', id);
            });
        }

        const response = await this.makeRequest('updateProduct', { product_id: productId }, formData);
        
        if (response.success) {
            this.showNotification(response.message || 'Product updated successfully!', 'success');
            
            // Update product list with new data
            if (response.updated_data) {
                this.updateProductInList(productId, response.updated_data);
            }
            
            setTimeout(() => {
                this.closeModal();
            }, 1500);
        } else {
            throw new Error(response.error || 'Failed to update product');
        }
    } catch (error) {
        console.error('Error saving product:', error);
        this.showNotification('Error saving product: ' + error.message, 'error');
    } finally {
        this.hideLoading();
    }
} // ✅ Затваряща скоба на saveProduct метода

    async createProduct() {
        if (this.isLoading) return;

        const form = document.querySelector('.quick-edit-form');
        if (!form) return;

        const formData = new FormData();
        const formElements = form.querySelectorAll('input, select, textarea');

        // Process special price
        const specialPriceInput = document.getElementById('field_special_price');
        if (specialPriceInput && specialPriceInput.value) {
            const today = new Date().toISOString().split('T')[0];
            formData.append('product_special[0][price]', specialPriceInput.value);
            formData.append('product_special[0][priority]', '1');
            formData.append('product_special[0][date_start]', today);
            formData.append('product_special[0][date_end]', '');
        }

        // Process related products
        const relatedInput = document.querySelector('input[name="product_related_input"]');
        if (relatedInput && relatedInput.value) {
            const relatedIds = relatedInput.value.split(',').map(id => id.trim()).filter(id => id);
            relatedIds.forEach(id => {
                formData.append('product_related[]', id);
            });
        }

        formElements.forEach(element => {
            if (element.type === 'checkbox') {
                if (element.checked) {
                    if (element.name.endsWith('[]')) {
                        formData.append(element.name, element.value);
                    } else {
                        formData.append(element.name, '1');
                    }
                } else {
                    if (!element.name.endsWith('[]')) {
                        formData.append(element.name, '0');
                    }
                }
            } else if (element.type === 'radio') {
                if (element.checked) {
                    formData.append(element.name, element.value);
                }
            } else if (element.type === 'select-multiple') {
                Array.from(element.selectedOptions).forEach(option => {
                    formData.append(element.name, option.value);
                });
} else {
                // We must send all fields, even empty ones, for the array structure to be correct
                if (element.name && !element.name.includes('product_related_input')) {
                    formData.append(element.name, element.value);
                }
            }
        });

        this.showLoading();

        try {
            const response = await this.makeRequest('createProduct', {}, formData);
            
            if (response.success) {
                this.showNotification(response.message || 'Product created successfully!', 'success');
                
                setTimeout(() => {
                    this.closeModal();
                    // Refresh the page to show new product
                    window.location.reload();
                }, 1500);
            } else {
                throw new Error(response.error || 'Failed to create product');
            }
        } catch (error) {
            console.error('Error creating product:', error);
            this.showNotification('Error creating product: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateProductInList(productId, updatedData) {
        const productRow = document.querySelector(`tr input[value="${productId}"]`)?.closest('tr');
        if (!productRow) return;

        // Update name (usually second column)
        const nameCell = productRow.querySelector('td:nth-child(2)');
        if (nameCell && updatedData.name) {
            nameCell.textContent = updatedData.name;
        }

        // Update model (usually third column)
        const modelCell = productRow.querySelector('td:nth-child(3)');
        if (modelCell && updatedData.model) {
            modelCell.textContent = updatedData.model;
        }

        // Update price (usually fourth column)
        const priceCell = productRow.querySelector('td:nth-child(4)');
        if (priceCell && updatedData.price) {
            priceCell.textContent = updatedData.price;
        }

        // Update quantity (usually fifth column)
        const quantityCell = productRow.querySelector('td:nth-child(5)');
        if (quantityCell && updatedData.quantity !== undefined) {
            quantityCell.textContent = updatedData.quantity;
            // Update quantity class for color
            quantityCell.className = updatedData.quantity <= 0 ? 'text-danger' : '';
        }

        // Update status (usually sixth column)
        const statusCell = productRow.querySelector('td:nth-child(6)');
        if (statusCell && updatedData.status !== undefined) {
            statusCell.innerHTML = updatedData.status ? 
                '<i class="fa fa-check-circle text-success"></i>' : 
                '<i class="fa fa-times-circle text-danger"></i>';
        }
    }

    toggleFieldVisibilityControls() {
        const controls = document.querySelector('.field-visibility-controls');
        if (controls) {
            controls.style.display = controls.style.display === 'block' ? 'none' : 'block';
        }
    }

    toggleFieldVisibilityState(fieldKey, isVisible) {
        const fieldElements = document.querySelectorAll(`[data-field="${fieldKey}"]`);
        
        fieldElements.forEach(element => {
            element.style.display = isVisible ? 'block' : 'none';
        });

        if (isVisible && !this.visibleFields.includes(fieldKey)) {
            this.visibleFields.push(fieldKey);
        } else if (!isVisible) {
            this.visibleFields = this.visibleFields.filter(f => f !== fieldKey);
        }

        this.storeVisibleFields();
    }

    applyFieldVisibility() {
        this.visibleFields.forEach(fieldKey => {
            const fieldElements = document.querySelectorAll(`[data-field="${fieldKey}"]`);
            fieldElements.forEach(element => {
                element.style.display = 'block';
            });
        });
    }

    toggleFullscreen() {
        const modal = document.querySelector('.quick-edit-modal');
        const content = document.querySelector('.quick-edit-content');
        const fullscreenBtn = document.querySelector('.fullscreen-btn');
        
        if (!this.isFullscreen) {
            // Enter fullscreen
            modal.classList.add('quick-edit-fullscreen');
            document.body.classList.add('fullscreen-active');
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = '<i class="fa fa-compress"></i> ' + (window.quickEditTexts?.exit_fullscreen || 'Exit Fullscreen');
            }
            this.isFullscreen = true;
        } else {
            // Exit fullscreen
            modal.classList.remove('quick-edit-fullscreen');
            document.body.classList.remove('fullscreen-active');
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = '<i class="fa fa-expand"></i> ' + (window.quickEditTexts?.fullscreen || 'Fullscreen');
            }
            this.isFullscreen = false;
        }
    }

    closeModal() {
        const modal = document.querySelector('.quick-edit-modal');
        const backdrop = document.querySelector('.overlay-backdrop');
        const visibilityControls = document.querySelector('.field-visibility-controls');
        
        if (modal) modal.remove();
        if (backdrop) backdrop.remove();
        if (visibilityControls) visibilityControls.remove();
        
        this.isFullscreen = false;
        document.body.classList.remove('fullscreen-active');
        
        // Clean up global reference
        window.quickEditInstance = null;
    }

    showLoading() {
        this.isLoading = true;
        // Add loading class to save button
        const saveBtn = document.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.classList.add('loading');
            saveBtn.disabled = true;
        }
    }

    hideLoading() {
        this.isLoading = false;
        // Remove loading class from save button
        const saveBtn = document.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.quick-edit-notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = `quick-edit-notification notification-${type}`;
        notification.innerHTML = `
            <i class="fa fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

async makeRequest(action, params = {}, formData = null) {
    try {
        // Използваме НОВИЯ контролер
        let url = 'index.php?route=extension/module/quick_product_edit_ajax/' + action;
        url += '&user_token=' + this.getUserToken();
        
        // Добавяме параметрите
        Object.keys(params).forEach(key => {
            url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        });

        const options = {
            method: formData ? 'POST' : 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        if (formData) {
            options.body = formData;
        }

        console.log('Making request to:', url);
        const response = await fetch(url, options);
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Request failed:', error);
        throw error;
    }
}

    getUserToken() {
        // Try from URL first
        const urlParams = new URLSearchParams(window.location.search);
        let token = urlParams.get('user_token');
        
        // If not in URL, try to find hidden input
        if (!token) {
            const tokenInput = document.querySelector('input[name="user_token"]');
            if (tokenInput) {
                token = tokenInput.value;
            }
        }
        
        // If still not found, check global variable
        if (!token && typeof user_token !== 'undefined') {
            token = user_token;
        }

        if (!token) {
            console.warn('User token not found!');
        }
        
        return token || '';
    }

    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    getText(key) {
        return window.quickEditTexts?.[key] || key;
    }

    getFieldLabel(fieldKey) {
        const labels = {
            'model': this.getText('field_model'),
            'sku': this.getText('field_sku'),
            'upc': this.getText('field_upc'),
            'ean': this.getText('field_ean'),
            'jan': this.getText('field_jan'),
            'isbn': this.getText('field_isbn'),
            'mpn': this.getText('field_mpn'),
            'location': this.getText('field_location'),
            'price': this.getText('field_price'),
            'quantity': this.getText('field_quantity'),
            'minimum': this.getText('field_minimum'),
            'status': this.getText('field_status'),
            'shipping': this.getText('field_shipping'),
            'subtract': this.getText('field_subtract'),
            'weight': this.getText('field_weight'),
            'length': this.getText('field_length'),
            'width': this.getText('field_width'),
            'height': this.getText('field_height'),
            'seo_keyword': this.getText('field_seo_keyword'),
            'sort_order': this.getText('field_sort_order')
        };
        
        return labels[fieldKey] || fieldKey;
    }

getAllFieldKeys() {
    return [
        'model', 'sku', 'upc', 'ean', 'jan', 'isbn', 'mpn', 'location',
        'price', 'quantity', 'minimum', 'status', 'shipping', 'subtract',
        'weight', 'length', 'width', 'height', 'seo_keyword', 'sort_order',
        'stock_status_id', 'manufacturer_id', 'special_price', 'main_image',
        'additional_images', 'categories', 'stores', 'filters', 'attributes',
        'downloads', 'related_products', 'options'
    ];
}

    storeVisibleFields() {
        localStorage.setItem('quick_edit_visible_fields', JSON.stringify(this.visibleFields));
    }

getStoredVisibleFields() {
    try {
        const stored = localStorage.getItem('quick_edit_visible_fields');
        return stored ? JSON.parse(stored) : this.getAllFieldKeys();
    } catch (e) {
        return this.getAllFieldKeys();
    }
}
}

// Разширена инициализация с повече проверки
function initializeQuickProductEdit() {
    // Проверка дали сме в административната част
    if (!window.location.href.includes('/admin/')) {
        return;
    }

    // Проверка дали сме на страница с продукти
    const isProductList = window.location.href.includes('catalog/product') && 
                         !window.location.href.includes('add') &&
                         !window.location.href.includes('edit');
    
    if (!isProductList) {
        console.log('Not on product list page, skipping Quick Product Edit');
        return;
    }

    // Изчакаме да се зареди DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                new QuickProductEdit();
            }, 500);
        });
    } else {
        setTimeout(() => {
            new QuickProductEdit();
        }, 500);
    }
}

// Стартиране
initializeQuickProductEdit();

// Също така инициализираме при AJAX зареждания (ако има такива)
if (typeof $ !== 'undefined') {
    $(document).ajaxComplete(function(event, xhr, settings) {
        if (settings.url.includes('catalog/product') && !settings.url.includes('user_token')) {
            setTimeout(() => {
                if (!window.quickEditInitialized) {
                    window.quickEditInitialized = true;
                    new QuickProductEdit();
                }
            }, 1000);
        }
    });
}

// Debug function - can be called from browser console
window.debugQuickEdit = function() {
    console.log('=== Quick Product Edit Debug ===');
    console.log('URL:', window.location.href);
    console.log('Product table found:', document.querySelector('#form-product') ? 'Yes' : 'No');
    console.log('Product rows:', document.querySelectorAll('#form-product tbody tr').length);
    console.log('Header container:', document.querySelector('.page-header .pull-right'));
    console.log('User token:', new QuickProductEdit().getUserToken());
    console.log('================');
};
