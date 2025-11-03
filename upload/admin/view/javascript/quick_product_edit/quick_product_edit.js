/**
 * Quick Product Edit Module for OpenCart 3.0.4.1
 * FIXED VERSION - Special price, Options, Attributes, Image Manager
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
        
        // File manager integration
        this.imageManagerCallbacks = {};
        
        window.quickEditInstance = this;
        this.init();
    }

    init() {
        if (this.initialized) return;
        
        console.log('Initializing Quick Product Edit...');
        
        if (!this.isProductPage()) {
            console.log('Not on product page');
            return;
        }
        
        this.waitForProductList().then(() => {
            this.addEditButtons();
            this.addCreateButton();
            this.setupEventListeners();
            this.initialized = true;
            console.log('Quick Product Edit initialized');
        }).catch(() => {
            setTimeout(() => this.init(), 1000);
        });
    }

    isProductPage() {
        const isAdmin = window.location.href.includes('/admin/');
        const isProductPage = window.location.href.includes('catalog/product');
        const isNotEditPage = !window.location.href.includes('add') && !window.location.href.includes('edit');
        return isAdmin && isProductPage && isNotEditPage;
    }

    waitForProductList() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const checkExist = setInterval(() => {
                attempts++;
                if (this.findProductTable() || attempts >= 10) {
                    clearInterval(checkExist);
                    this.findProductTable() ? resolve() : reject();
                }
            }, 500);
        });
    }

    findProductTable() {
        const selectors = ['#form-product', 'form[action*="product"]', '.table-responsive table'];
        for (let selector of selectors) {
            const el = document.querySelector(selector);
            if (el) return el;
        }
        return null;
    }

    addEditButtons() {
        this.getProductRows().forEach(row => {
            const productId = this.getProductIdFromRow(row);
            if (!productId || row.querySelector('.quick-edit-btn')) return;
            
            const editBtn = this.createQuickEditButton(productId);
            this.insertEditButton(row, editBtn);
        });
    }

    getProductRows() {
        const table = this.findProductTable();
        if (!table) return [];
        return Array.from(table.querySelectorAll('tbody tr')).filter(row => 
            row.querySelector('input[type="checkbox"][name="selected[]"]')?.value
        );
    }

    getProductIdFromRow(row) {
        return row.querySelector('input[type="checkbox"][name="selected[]"]')?.value;
    }

    createQuickEditButton(productId) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-default btn-sm quick-edit-btn';
        btn.innerHTML = '<i class="fa fa-bolt"></i> Quick Edit';
        btn.setAttribute('data-product-id', productId);
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openEditModal(productId);
        };
        return btn;
    }

    insertEditButton(row, editBtn) {
        const actionsCell = row.querySelector('td.text-right, td:last-child');
        if (actionsCell) {
            const existingBtn = actionsCell.querySelector('a[href*="edit"]');
            if (existingBtn) {
                existingBtn.parentNode.insertBefore(editBtn, existingBtn.nextSibling);
            } else {
                actionsCell.insertBefore(editBtn, actionsCell.firstChild);
            }
        }
    }

    addCreateButton() {
        const selectors = ['.page-header .pull-right', '.container-fluid .pull-right'];
        let container = null;
        for (let selector of selectors) {
            container = document.querySelector(selector);
            if (container) break;
        }
        
        if (!container || container.querySelector('.quick-create-btn')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-primary quick-create-btn';
        btn.innerHTML = '<i class="fa fa-plus"></i> Quick Create';
        btn.onclick = () => this.openCreateModal();
        container.insertBefore(btn, container.firstChild);
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        const observer = new MutationObserver(() => {
            setTimeout(() => {
                this.addEditButtons();
                this.addCreateButton();
            }, 100);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // IMAGE MANAGER INTEGRATION - FIXED
    openImageManager(fieldId, previewId) {
        console.log('Opening image manager:', fieldId, previewId);
        
        // Store callback info
        this.imageManagerCallbacks[fieldId] = previewId;
        
        // Create trigger button for OpenCart file manager
        const input = document.getElementById(fieldId);
        if (!input) {
            console.error('Field not found:', fieldId);
            return;
        }

        // Create temporary button that OpenCart can hook into
        const tempBtn = document.createElement('a');
        tempBtn.id = 'button-image-' + fieldId;
        tempBtn.setAttribute('data-toggle', 'image');
        tempBtn.style.display = 'none';
        document.body.appendChild(tempBtn);

        // Set up the callback
        window['image_' + fieldId] = (image) => {
            input.value = image;
            
            const preview = document.getElementById(previewId);
            if (preview) {
                preview.innerHTML = `<img src="${image}" style="max-width: 100%; max-height: 100%;" />`;
            }
            
            this.showNotification('Image selected', 'success');
            tempBtn.remove();
        };

        // Trigger OpenCart file manager
        if (typeof $.fn.filemanager !== 'undefined') {
            $(tempBtn).filemanager({
                type: 'image',
                id: fieldId,
                multiple: false,
                callback: 'image_' + fieldId
            });
            $(tempBtn).trigger('click');
        } else {
            // Fallback: Open standard file manager
            const url = 'index.php?route=common/filemanager&user_token=' + this.getUserToken() + '&target=' + fieldId;
            const width = 800;
            const height = 600;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;
            
            window.open(url, 'file-manager', 
                `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
            
            // Set up global callback for file manager
            window['filemanager_' + fieldId] = (file) => {
                input.value = file;
                const preview = document.getElementById(previewId);
                if (preview) {
                    preview.innerHTML = `<img src="${file}" style="max-width: 100%; max-height: 100%;" />`;
                }
                this.showNotification('Image selected', 'success');
            };
        }
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
            console.error('Error:', error);
            this.showNotification('Error loading product: ' + error.message, 'error');
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
            const emptyData = this.getEmptyProductData();
            this.showModal(emptyData);
        } catch (error) {
            console.error('Error:', error);
            this.showNotification('Error: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    getEmptyProductData() {
        const languages = this.fieldData?.languages || [];
        const descriptions = {};
        languages.forEach(lang => {
            descriptions[lang.language_id] = {
                name: '',
                description: '',
                meta_title: '',
                meta_description: '',
                meta_keyword: '',
                tag: ''
            };
        });

        return {
            product_id: null,
            model: '',
            sku: '',
            price: '',
            quantity: 0,
            status: 1,
            product_description: descriptions,
            product_category: [],
            product_special: [],
            product_option: [],
            product_attribute: [],
            product_image: [],
            product_store: [0]
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
            // Process special price for display
            if (response.product_special && response.product_special.length > 0) {
                response.special_price = response.product_special[0].price;
            }
            return response;
        }
        throw new Error(response.error || 'Failed to load product');
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

    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    getUserToken() {
        const urlParams = new URLSearchParams(window.location.search);
        let token = urlParams.get('user_token');
        if (!token) {
            const input = document.querySelector('input[name="user_token"]');
            if (input) token = input.value;
        }
        if (!token && typeof user_token !== 'undefined') {
            token = user_token;
        }
        return token || '';
    }

async makeRequest(action, params = {}, formData = null) {
    try {
        let url = 'index.php?route=extension/module/quick_product_edit_ajax/' + action;
        url += '&user_token=' + this.getUserToken();
        
        Object.keys(params).forEach(key => {
            url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        });

        const options = {
            method: formData ? 'POST' : 'GET',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        };

        if (formData) options.body = formData;

        console.log('Making request to:', url);
        const response = await fetch(url, options);

        // Чети текста само веднъж
        const text = await response.text();

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            console.error('Non-JSON response received (full):', text);
            
            const errorPatterns = [
                /<b>(.+?)<\/b>/s,
                /Fatal error: (.+?) in/i,
                /Parse error: (.+?) in/i,
                /Warning: (.+?) in/i,
                /Notice: (.+?) in/i
            ];

            for (let pattern of errorPatterns) {
                const match = text.match(pattern);
                if (match) {
                    throw new Error('PHP Error: ' + match[1].replace(/<[^>]*>/g, '').trim());
                }
            }
            throw new Error('Server returned HTML instead of JSON. Check console for full response.');
        }

        // Прочети JSON само от вече взетия текст
        const result = JSON.parse(text);

        if (result.error && !result.success) {
            throw new Error(result.error);
        }

        return result;

    } catch (error) {
        console.error('Request failed:', error);
        if (error.message.includes('JSON')) {
            error.message = 'Server error - check that the controller file is uploaded correctly and has no PHP errors';
        }
        throw error;
    }
}


    showLoading() {
        this.isLoading = true;
        const saveBtn = document.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.classList.add('loading');
            saveBtn.disabled = true;
        }
    }

    hideLoading() {
        this.isLoading = false;
        const saveBtn = document.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.classList.remove('loading');
            saveBtn.disabled = false;
        }
    }

    showNotification(message, type = 'info') {
        document.querySelectorAll('.quick-edit-notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `quick-edit-notification notification-${type}`;
        notification.innerHTML = `
            <i class="fa fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }

    closeModal() {
        document.querySelector('.quick-edit-modal')?.remove();
        document.querySelector('.overlay-backdrop')?.remove();
        document.querySelector('.field-visibility-controls')?.remove();
        this.isFullscreen = false;
        document.body.classList.remove('fullscreen-active');
        window.quickEditInstance = null;
    }

    getAllFieldKeys() {
        return ['model', 'sku', 'price', 'quantity', 'status', 'special_price', 'options', 'attributes'];
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

// Initialize
function initializeQuickProductEdit() {
    if (!window.location.href.includes('/admin/')) return;
    
    const isProductList = window.location.href.includes('catalog/product') && 
                         !window.location.href.includes('add') &&
                         !window.location.href.includes('edit');
    
    if (!isProductList) return;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => new QuickProductEdit(), 500);
        });
    } else {
        setTimeout(() => new QuickProductEdit(), 500);
    }
}

initializeQuickProductEdit();
/**
 * Part 2: Modal HTML Generation and Form Handling
 * Add this code after Part 1
 */

// Add to QuickProductEdit class prototype:

QuickProductEdit.prototype.getModalHTML = function(productData) {
    const title = this.isNewProduct ? 
        'Create New Product' : 
        `Edit Product: ${this.escapeHtml(productData.name || 'Unknown Product')}`;
    
    return `
        <div class="quick-edit-content">
            <div class="quick-edit-header">
                <h3><i class="fa ${this.isNewProduct ? 'fa-plus' : 'fa-edit'}"></i> ${title}</h3>
                <div class="quick-edit-controls">
                    <button type="button" class="fullscreen-btn">
                        <i class="fa fa-expand"></i> Fullscreen
                    </button>
                    <button type="button" class="save-btn btn-primary">
                        <i class="fa fa-save"></i> ${this.isNewProduct ? 'Create' : 'Save'}
                    </button>
                    <button type="button" class="close-btn">
                        <i class="fa fa-times"></i> Close
                    </button>
                </div>
            </div>
            
            <div class="quick-edit-body">
                <form class="quick-edit-form">
                    <div class="quick-edit-tabs">
                        <div class="tab-buttons">
                            <button type="button" class="tab-button active" data-tab="general">General</button>
                            <button type="button" class="tab-button" data-tab="data">Data & Images</button>
                            <button type="button" class="tab-button" data-tab="links">Links</button>
                            <button type="button" class="tab-button" data-tab="attributes">Attributes</button>
                            <button type="button" class="tab-button" data-tab="options">Options</button>
                        </div>
                        
                        <div class="tab-content active" data-tab="general">
                            ${this.generateGeneralTab(productData)}
                        </div>
                        
                        <div class="tab-content" data-tab="data">
                            ${this.generateDataTab(productData)}
                        </div>
                        
                        <div class="tab-content" data-tab="links">
                            ${this.generateLinksTab(productData)}
                        </div>
                        
                        <div class="tab-content" data-tab="attributes">
                            ${this.generateAttributesTab(productData)}
                        </div>
                        
                        <div class="tab-content" data-tab="options">
                            ${this.generateOptionsTab(productData)}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
};

QuickProductEdit.prototype.generateGeneralTab = function(productData) {
    return `
        <div class="quick-edit-fields">
            <div class="field-group-section">
                <h4>Product Information</h4>
                ${this.generateLanguageFields(productData.product_description)}
            </div>

            <div class="field-group-section">
                <h4>Pricing & Stock</h4>
                <div class="quick-edit-field-group">
                    <label for="field_model">Model</label>
                    <input type="text" id="field_model" name="model" value="${this.escapeHtml(productData.model || '')}" class="form-control">
                </div>
                
                <div class="quick-edit-field-group">
                    <label for="field_price">Price</label>
                    <input type="number" id="field_price" name="price" value="${this.escapeHtml(productData.price || '')}" step="0.01" class="form-control">
                </div>
                
                <div class="quick-edit-field-group">
                    <label for="field_special_price">Special Price</label>
                    <input type="number" id="field_special_price" name="special_price" value="${this.escapeHtml(productData.special_price || '')}" step="0.01" class="form-control">
                    <small class="text-muted">Leave empty to remove special price</small>
                </div>
                
                <div class="quick-edit-field-group">
                    <label for="field_quantity">Quantity</label>
                    <input type="number" id="field_quantity" name="quantity" value="${this.escapeHtml(productData.quantity || '0')}" class="form-control">
                </div>
                
                <div class="quick-edit-field-group">
                    <label for="field_status">Status</label>
                    <select id="field_status" name="status" class="form-control">
                        <option value="1" ${productData.status == 1 ? 'selected' : ''}>Enabled</option>
                        <option value="0" ${productData.status == 0 ? 'selected' : ''}>Disabled</option>
                    </select>
                </div>
            </div>
        </div>
    `;
};

QuickProductEdit.prototype.generateLanguageFields = function(descriptions) {
    const languages = this.fieldData?.languages || [];
    if (languages.length === 0) return '';

    let html = '<div class="language-tabs"><div class="language-tab-buttons">';

    languages.forEach((lang, index) => {
        html += `<button type="button" class="language-tab-button ${index === 0 ? 'active' : ''}" data-language="${lang.language_id}">
                    <img src="language/${lang.code}/${lang.code}.png" alt="${lang.name}" /> ${lang.name}
                </button>`;
    });

    html += '</div>';

    languages.forEach((lang, index) => {
        const langData = descriptions?.[lang.language_id] || {};
        html += `
            <div class="language-tab-content ${index === 0 ? 'active' : ''}" data-language="${lang.language_id}">
                <div class="quick-edit-field-group">
                    <label for="field_name_${lang.language_id}">Product Name *</label>
                    <input type="text" id="field_name_${lang.language_id}" name="product_description[${lang.language_id}][name]" 
                           value="${this.escapeHtml(langData.name || '')}" class="form-control" required>
                </div>
                <div class="quick-edit-field-group">
                    <label for="field_description_${lang.language_id}">Description</label>
                    <textarea id="field_description_${lang.language_id}" name="product_description[${lang.language_id}][description]" 
                              class="form-control" rows="4">${this.escapeHtml(langData.description || '')}</textarea>
                </div>
                <div class="quick-edit-field-group">
                    <label for="field_meta_title_${lang.language_id}">Meta Title</label>
                    <input type="text" id="field_meta_title_${lang.language_id}" name="product_description[${lang.language_id}][meta_title]" 
                           value="${this.escapeHtml(langData.meta_title || langData.name || '')}" class="form-control">
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
};

QuickProductEdit.prototype.generateDataTab = function(productData) {
    return `
        <div class="quick-edit-fields">
            <div class="field-group-section">
                <h4>Product Data</h4>
                <div class="quick-edit-field-group">
                    <label for="field_sku">SKU</label>
                    <input type="text" id="field_sku" name="sku" value="${this.escapeHtml(productData.sku || '')}" class="form-control">
                </div>
                <div class="quick-edit-field-group">
                    <label for="field_upc">UPC</label>
                    <input type="text" id="field_upc" name="upc" value="${this.escapeHtml(productData.upc || '')}" class="form-control">
                </div>
            </div>

            <div class="field-group-section">
                <h4>Product Images</h4>
                <div class="quick-edit-field-group">
                    <label>Main Image</label>
                    <div class="image-upload-container">
                        <div class="image-preview" id="main-image-preview" style="max-width: 200px; max-height: 200px; border: 1px solid #ddd; padding: 5px; margin-bottom: 10px;">
                            ${productData.image ? `<img src="${this.escapeHtml(productData.image)}" style="max-width: 100%; max-height: 100%;" />` : '<span class="text-muted">No image</span>'}
                        </div>
                        <div class="input-group">
                            <input type="text" name="image" value="${this.escapeHtml(productData.image || '')}" id="main-image-input" class="form-control" readonly>
                            <span class="input-group-btn">
                                <button type="button" class="btn btn-primary open-image-manager" data-field="main-image-input" data-preview="main-image-preview">
                                    <i class="fa fa-folder-open"></i> Select
                                </button>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

QuickProductEdit.prototype.generateLinksTab = function(productData) {
    const categories = this.fieldData?.categories || [];
    
    return `
        <div class="quick-edit-fields">
            <div class="field-group-section">
                <h4>Categories</h4>
                <div class="category-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px;">
                    ${categories.map(cat => `
                        <div class="checkbox">
                            <label>
                                <input type="checkbox" name="product_category[]" value="${cat.category_id}" 
                                    ${(productData.product_category || []).includes(parseInt(cat.category_id)) ? 'checked' : ''}>
                                ${this.escapeHtml(cat.name)}
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
};

QuickProductEdit.prototype.generateAttributesTab = function(productData) {
    const attributeGroups = this.fieldData?.attribute_groups || [];
    
    return `
        <div class="quick-edit-fields">
            <div class="field-group-section">
                <h4>Product Attributes</h4>
                <div class="form-group">
                    <label>Attribute</label>
                    <input type="text" id="input-attribute" placeholder="Start typing attribute name..." class="form-control" autocomplete="off">
                    <input type="hidden" id="input-attribute-id" name="attribute_id">
                    <div id="attribute-autocomplete" class="dropdown-menu" style="display:none;"></div>
                </div>
                <div class="form-group">
                    <label>Text</label>
                    <textarea id="input-attribute-text" rows="3" class="form-control" placeholder="Enter attribute value"></textarea>
                </div>
                <button type="button" id="button-attribute" class="btn btn-primary">
                    <i class="fa fa-plus-circle"></i> Add Attribute
                </button>
                
                <div id="product-attribute" class="table-responsive" style="margin-top: 20px;">
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Attribute</th>
                                <th>Text</th>
                                <th width="80">Action</th>
                            </tr>
                        </thead>
                        <tbody id="attribute-rows">
                            ${this.generateAttributeRows(productData.product_attribute || [])}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
};

QuickProductEdit.prototype.generateAttributeRows = function(attributes) {
    if (!attributes || attributes.length === 0) {
        return '<tr><td colspan="3" class="text-center text-muted">No attributes added</td></tr>';
    }

    let html = '';
    attributes.forEach((attr, index) => {
        // Get the text value - it can be in different structures
        let text = '';
        if (attr.product_attribute_description) {
            const firstLang = Object.keys(attr.product_attribute_description)[0];
            text = attr.product_attribute_description[firstLang]?.text || '';
        } else if (attr.text) {
            text = attr.text;
        }

        html += `
            <tr id="attribute-row-${index}">
                <td>
                    ${this.escapeHtml(attr.name)}
                    <input type="hidden" name="product_attribute[${index}][attribute_id]" value="${attr.attribute_id}">
                </td>
                <td>
                    <textarea name="product_attribute[${index}][product_attribute_description][${this.config_language_id || 1}][text]" class="form-control" rows="2">${this.escapeHtml(text)}</textarea>
                </td>
                <td class="text-center">
                    <button type="button" onclick="document.getElementById('attribute-row-${index}').remove(); if(document.getElementById('attribute-rows').children.length === 0) document.getElementById('attribute-rows').innerHTML = '<tr><td colspan=\\'3\\' class=\\'text-center text-muted\\'>No attributes added</td></tr>';" class="btn btn-danger btn-sm">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    return html;
};

QuickProductEdit.prototype.generateOptionsTab = function(productData) {
    return `
        <div class="quick-edit-fields">
            <div class="field-group-section">
                <h4>Product Options</h4>
                <div class="form-group">
                    <label>Select Option</label>
                    <div class="input-group">
                        <select id="input-option" class="form-control">
                            <option value="">-- Select Option --</option>
                            ${(this.fieldData?.options || []).map(opt => 
                                `<option value="${opt.option_id}" data-type="${opt.type}">${this.escapeHtml(opt.name)}</option>`
                            ).join('')}
                        </select>
                        <span class="input-group-btn">
                            <button type="button" id="button-option" class="btn btn-primary">
                                <i class="fa fa-plus-circle"></i> Add Option
                            </button>
                        </span>
                    </div>
                </div>
                
                <div id="option-list">
                    ${this.generateOptionList(productData.product_option || [])}
                </div>
            </div>
        </div>
    `;
};

QuickProductEdit.prototype.generateOptionList = function(options) {
    if (!options || options.length === 0) {
        return '<p class="text-center text-muted">No options added</p>';
    }

    let html = '';
    options.forEach((option, index) => {
        html += this.generateOptionPanel(option, index);
    });
    return html;
};

QuickProductEdit.prototype.generateOptionPanel = function(option, index) {
    const optionInfo = (this.fieldData?.options || []).find(o => o.option_id == option.option_id);
    const optionName = optionInfo?.name || option.name || 'Unknown Option';
    const optionType = option.type;

    let html = `
        <div class="panel panel-default" id="option-panel-${index}" style="margin-top: 15px;">
            <div class="panel-heading">
                <h4 class="panel-title">
                    ${this.escapeHtml(optionName)}
                    <button type="button" class="btn btn-danger btn-xs pull-right" onclick="document.getElementById('option-panel-${index}').remove();">
                        <i class="fa fa-trash"></i> Remove
                    </button>
                </h4>
            </div>
            <div class="panel-body">
                <input type="hidden" name="product_option[${index}][product_option_id]" value="${option.product_option_id || ''}">
                <input type="hidden" name="product_option[${index}][option_id]" value="${option.option_id}">
                <input type="hidden" name="product_option[${index}][type]" value="${optionType}">
                
                <div class="form-group">
                    <label>Required</label>
                    <select name="product_option[${index}][required]" class="form-control">
                        <option value="1" ${option.required == 1 ? 'selected' : ''}>Yes</option>
                        <option value="0" ${option.required == 0 ? 'selected' : ''}>No</option>
                    </select>
                </div>
    `;

    if (['select', 'radio', 'checkbox', 'image'].includes(optionType)) {
        html += this.generateOptionValueTable(option, index);
    } else {
        html += `<div class="form-group">
                    <label>Default Value</label>
                    <input type="text" name="product_option[${index}][value]" value="${this.escapeHtml(option.value || '')}" class="form-control">
                </div>`;
    }

    html += '</div></div>';
    return html;
};

QuickProductEdit.prototype.generateOptionValueTable = function(option, optionIndex) {
    const optionValues = option.product_option_value || [];
    
    let html = `
        <table class="table table-bordered" id="option-value-table-${optionIndex}">
            <thead>
                <tr>
                    <th>Option Value</th>
                    <th width="100">Quantity</th>
                    <th width="150">Price</th>
                    <th width="80">Action</th>
                </tr>
            </thead>
            <tbody>
    `;

    optionValues.forEach((value, valueIndex) => {
        html += this.generateOptionValueRow(option, optionIndex, value, valueIndex);
    });

    if (optionValues.length === 0) {
        html += '<tr><td colspan="4" class="text-center text-muted">No values added</td></tr>';
    }

    html += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="4">
                        <button type="button" class="btn btn-success btn-sm" onclick="window.quickEditInstance.addOptionValue(${optionIndex}, ${option.option_id})">
                            <i class="fa fa-plus"></i> Add Value
                        </button>
                    </td>
                </tr>
            </tfoot>
        </table>
    `;

    return html;
};

QuickProductEdit.prototype.generateOptionValueRow = function(option, optionIndex, value, valueIndex) {
    const availableValues = (this.fieldData?.options || []).find(o => o.option_id == option.option_id)?.values || [];
    
    return `
        <tr id="option-value-row-${optionIndex}-${valueIndex}">
            <td>
                <select name="product_option[${optionIndex}][product_option_value][${valueIndex}][option_value_id]" class="form-control" required>
                    <option value="">-- Select --</option>
                    ${availableValues.map(v => 
                        `<option value="${v.option_value_id}" ${v.option_value_id == value.option_value_id ? 'selected' : ''}>${this.escapeHtml(v.name)}</option>`
                    ).join('')}
                </select>
                <input type="hidden" name="product_option[${optionIndex}][product_option_value][${valueIndex}][product_option_value_id]" value="${value.product_option_value_id || ''}">
            </td>
            <td>
                <input type="number" name="product_option[${optionIndex}][product_option_value][${valueIndex}][quantity]" 
                       value="${value.quantity || 0}" class="form-control" min="0">
            </td>
            <td>
                <div class="input-group">
                    <span class="input-group-addon" style="padding: 0;">
                        <select name="product_option[${optionIndex}][product_option_value][${valueIndex}][price_prefix]" class="form-control" style="border:none; width:50px;">
                            <option value="+" ${value.price_prefix == '+' ? 'selected' : ''}>+</option>
                            <option value="-" ${value.price_prefix == '-' ? 'selected' : ''}>-</option>
                        </select>
                    </span>
                    <input type="number" name="product_option[${optionIndex}][product_option_value][${valueIndex}][price]" 
                           value="${value.price || 0}" step="0.01" class="form-control">
                </div>
                <input type="hidden" name="product_option[${optionIndex}][product_option_value][${valueIndex}][subtract]" value="${value.subtract || 0}">
                <input type="hidden" name="product_option[${optionIndex}][product_option_value][${valueIndex}][points]" value="${value.points || 0}">
                <input type="hidden" name="product_option[${optionIndex}][product_option_value][${valueIndex}][points_prefix]" value="${value.points_prefix || '+'}">
                <input type="hidden" name="product_option[${optionIndex}][product_option_value][${valueIndex}][weight]" value="${value.weight || 0}">
                <input type="hidden" name="product_option[${optionIndex}][product_option_value][${valueIndex}][weight_prefix]" value="${value.weight_prefix || '+'}">
            </td>
            <td class="text-center">
                <button type="button" onclick="document.getElementById('option-value-row-${optionIndex}-${valueIndex}').remove();" class="btn btn-danger btn-sm">
                    <i class="fa fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
};
/**
 * Part 3: Event Handlers and Save Functionality
 * Add this code after Part 2
 */

QuickProductEdit.prototype.setupModalHandlers = function(modal, productData) {
    // Save button
    modal.querySelector('.save-btn')?.addEventListener('click', () => {
        if (this.isNewProduct) {
            this.createProduct();
        } else {
            this.saveProduct(productData.product_id);
        }
    });

    // Close button
    modal.querySelector('.close-btn')?.addEventListener('click', () => this.closeModal());

    // Fullscreen toggle
    modal.querySelector('.fullscreen-btn')?.addEventListener('click', () => this.toggleFullscreen());

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

    // Image manager buttons
    modal.querySelectorAll('.open-image-manager').forEach(button => {
        button.addEventListener('click', () => {
            const fieldId = button.getAttribute('data-field');
            const previewId = button.getAttribute('data-preview');
            this.openImageManager(fieldId, previewId);
        });
    });

    // Attribute functionality
    this.setupAttributeHandlers(modal);

    // Option functionality
    this.setupOptionHandlers(modal);
};

QuickProductEdit.prototype.setupAttributeHandlers = function(modal) {
    const attributeInput = modal.querySelector('#input-attribute');
    const attributeIdInput = modal.querySelector('#input-attribute-id');
    const attributeTextInput = modal.querySelector('#input-attribute-text');
    const addAttributeBtn = modal.querySelector('#button-attribute');
    const autocompleteDiv = modal.querySelector('#attribute-autocomplete');

    if (!attributeInput || !addAttributeBtn) return;

    // Autocomplete for attributes
    let attributeTimeout;
    attributeInput.addEventListener('input', (e) => {
        clearTimeout(attributeTimeout);
        const query = e.target.value;
        
        if (query.length < 2) {
            autocompleteDiv.style.display = 'none';
            return;
        }

        attributeTimeout = setTimeout(() => {
            this.searchAttributes(query, autocompleteDiv, attributeInput, attributeIdInput);
        }, 300);
    });

    // Add attribute button
    addAttributeBtn.addEventListener('click', () => {
        const attributeId = attributeIdInput.value;
        const attributeName = attributeInput.value;
        const attributeText = attributeTextInput.value;

        if (!attributeId || !attributeName) {
            this.showNotification('Please select an attribute', 'warning');
            return;
        }

        if (!attributeText) {
            this.showNotification('Please enter attribute text', 'warning');
            return;
        }

        this.addAttributeRow(attributeId, attributeName, attributeText);

        // Clear inputs
        attributeInput.value = '';
        attributeIdInput.value = '';
        attributeTextInput.value = '';
        autocompleteDiv.style.display = 'none';
    });

    // Close autocomplete on click outside
    document.addEventListener('click', (e) => {
        if (!attributeInput.contains(e.target) && !autocompleteDiv.contains(e.target)) {
            autocompleteDiv.style.display = 'none';
        }
    });
};

QuickProductEdit.prototype.searchAttributes = function(query, autocompleteDiv, attributeInput, attributeIdInput) {
    const allAttributes = [];
    
    // Collect all attributes from all groups
    (this.fieldData?.attribute_groups || []).forEach(group => {
        (group.attributes || []).forEach(attr => {
            allAttributes.push({
                attribute_id: attr.attribute_id,
                name: attr.name,
                group: group.name
            });
        });
    });

    // Filter attributes
    const filtered = allAttributes.filter(attr => 
        attr.name.toLowerCase().includes(query.toLowerCase())
    );

    if (filtered.length === 0) {
        autocompleteDiv.style.display = 'none';
        return;
    }

    // Generate autocomplete HTML
    let html = '';
    filtered.slice(0, 10).forEach(attr => {
        html += `
            <div class="autocomplete-item" style="padding: 8px; cursor: pointer; border-bottom: 1px solid #eee;" 
                 data-id="${attr.attribute_id}" data-name="${this.escapeHtml(attr.name)}">
                <strong>${this.escapeHtml(attr.name)}</strong>
                <small class="text-muted"> (${this.escapeHtml(attr.group)})</small>
            </div>
        `;
    });

    autocompleteDiv.innerHTML = html;
    autocompleteDiv.style.display = 'block';
    autocompleteDiv.style.position = 'absolute';
    autocompleteDiv.style.width = attributeInput.offsetWidth + 'px';
    autocompleteDiv.style.maxHeight = '200px';
    autocompleteDiv.style.overflowY = 'auto';
    autocompleteDiv.style.zIndex = '1000';

    // Add click handlers
    autocompleteDiv.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            attributeInput.value = item.getAttribute('data-name');
            attributeIdInput.value = item.getAttribute('data-id');
            autocompleteDiv.style.display = 'none';
        });
    });
};

QuickProductEdit.prototype.addAttributeRow = function(attributeId, attributeName, attributeText) {
    const tbody = document.getElementById('attribute-rows');
    if (!tbody) return;

    // Remove "no attributes" message if present
    const emptyRow = tbody.querySelector('td[colspan]');
    if (emptyRow) {
        emptyRow.parentElement.remove();
    }

    const index = tbody.children.length;
    const languageId = this.config_language_id || 1;

    const row = document.createElement('tr');
    row.id = `attribute-row-${index}`;
    row.innerHTML = `
        <td>
            ${this.escapeHtml(attributeName)}
            <input type="hidden" name="product_attribute[${index}][attribute_id]" value="${attributeId}">
        </td>
        <td>
            <textarea name="product_attribute[${index}][product_attribute_description][${languageId}][text]" class="form-control" rows="2">${this.escapeHtml(attributeText)}</textarea>
        </td>
        <td class="text-center">
            <button type="button" onclick="this.closest('tr').remove(); if(document.getElementById('attribute-rows').children.length === 0) document.getElementById('attribute-rows').innerHTML = '<tr><td colspan=\\'3\\' class=\\'text-center text-muted\\'>No attributes added</td></tr>';" class="btn btn-danger btn-sm">
                <i class="fa fa-trash"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);
    this.showNotification('Attribute added', 'success');
};

QuickProductEdit.prototype.setupOptionHandlers = function(modal) {
    const optionSelect = modal.querySelector('#input-option');
    const addOptionBtn = modal.querySelector('#button-option');

    if (!optionSelect || !addOptionBtn) return;

    addOptionBtn.addEventListener('click', () => {
        const optionId = optionSelect.value;
        if (!optionId) {
            this.showNotification('Please select an option', 'warning');
            return;
        }

        const selectedOption = (this.fieldData?.options || []).find(o => o.option_id == optionId);
        if (!selectedOption) {
            this.showNotification('Option not found', 'error');
            return;
        }

        this.addOptionPanel(selectedOption);
        optionSelect.value = '';
    });
};

QuickProductEdit.prototype.addOptionPanel = function(optionInfo) {
    const optionList = document.getElementById('option-list');
    if (!optionList) return;

    // Remove "no options" message
    const emptyMsg = optionList.querySelector('p.text-muted');
    if (emptyMsg) emptyMsg.remove();

    const index = optionList.querySelectorAll('.panel').length;

    const newOption = {
        product_option_id: '',
        option_id: optionInfo.option_id,
        name: optionInfo.name,
        type: optionInfo.type,
        required: 0,
        value: '',
        product_option_value: []
    };

    const panelHTML = this.generateOptionPanel(newOption, index);
    optionList.insertAdjacentHTML('beforeend', panelHTML);

    this.showNotification('Option added', 'success');
};

QuickProductEdit.prototype.addOptionValue = function(optionIndex, optionId) {
    const tbody = document.querySelector(`#option-value-table-${optionIndex} tbody`);
    if (!tbody) return;

    // Remove empty message if present
    const emptyRow = tbody.querySelector('td[colspan]');
    if (emptyRow) emptyRow.parentElement.remove();

    const valueIndex = tbody.children.length;
    const option = { option_id: optionId, product_option_value: [] };
    const newValue = {
        product_option_value_id: '',
        option_value_id: '',
        quantity: 0,
        price: 0,
        price_prefix: '+',
        subtract: 0,
        points: 0,
        points_prefix: '+',
        weight: 0,
        weight_prefix: '+'
    };

    const rowHTML = this.generateOptionValueRow(option, optionIndex, newValue, valueIndex);
    tbody.insertAdjacentHTML('beforeend', rowHTML);
};

QuickProductEdit.prototype.switchTab = function(tabName, modal) {
    modal.querySelectorAll('.tab-button').forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-tab') === tabName);
    });

    modal.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.getAttribute('data-tab') === tabName);
    });
};

QuickProductEdit.prototype.switchLanguageTab = function(languageId, modal) {
    modal.querySelectorAll('.language-tab-button').forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-language') === languageId);
    });

    modal.querySelectorAll('.language-tab-content').forEach(content => {
        content.classList.toggle('active', content.getAttribute('data-language') === languageId);
    });
};

QuickProductEdit.prototype.toggleFullscreen = function() {
    const modal = document.querySelector('.quick-edit-modal');
    const btn = document.querySelector('.fullscreen-btn');
    
    if (!this.isFullscreen) {
        modal.classList.add('quick-edit-fullscreen');
        document.body.classList.add('fullscreen-active');
        if (btn) btn.innerHTML = '<i class="fa fa-compress"></i> Exit Fullscreen';
        this.isFullscreen = true;
    } else {
        modal.classList.remove('quick-edit-fullscreen');
        document.body.classList.remove('fullscreen-active');
        if (btn) btn.innerHTML = '<i class="fa fa-expand"></i> Fullscreen';
        this.isFullscreen = false;
    }
};

QuickProductEdit.prototype.saveProduct = async function(productId) {
    if (this.isLoading) return;

    const form = document.querySelector('.quick-edit-form');
    if (!form) return;

    this.showLoading();

    try {
        const formData = new FormData();
        
        // Process all form elements
        const elements = form.querySelectorAll('input, select, textarea');
        elements.forEach(element => {
            if (!element.name) return;

            if (element.type === 'checkbox') {
                if (element.name.endsWith('[]')) {
                    if (element.checked) {
                        formData.append(element.name, element.value);
                    }
                } else {
                    formData.append(element.name, element.checked ? '1' : '0');
                }
            } else if (element.type === 'radio') {
                if (element.checked) {
                    formData.append(element.name, element.value);
                }
            } else {
                formData.append(element.name, element.value);
            }
        });

        const response = await this.makeRequest('updateProduct', { product_id: productId }, formData);
        
        if (response.success) {
            this.showNotification(response.message || 'Product updated successfully!', 'success');
            
            if (response.updated_data) {
                this.updateProductInList(productId, response.updated_data);
            }
            
            setTimeout(() => this.closeModal(), 1500);
        } else {
            throw new Error(response.error || 'Failed to update product');
        }
    } catch (error) {
        console.error('Error:', error);
        this.showNotification('Error: ' + error.message, 'error');
    } finally {
        this.hideLoading();
    }
};

QuickProductEdit.prototype.createProduct = async function() {
    if (this.isLoading) return;

    const form = document.querySelector('.quick-edit-form');
    if (!form) return;

    this.showLoading();

    try {
        const formData = new FormData();
        
        const elements = form.querySelectorAll('input, select, textarea');
        elements.forEach(element => {
            if (!element.name) return;

            if (element.type === 'checkbox') {
                if (element.name.endsWith('[]')) {
                    if (element.checked) {
                        formData.append(element.name, element.value);
                    }
                } else {
                    formData.append(element.name, element.checked ? '1' : '0');
                }
            } else if (element.type === 'radio') {
                if (element.checked) {
                    formData.append(element.name, element.value);
                }
            } else {
                formData.append(element.name, element.value);
            }
        });

        const response = await this.makeRequest('createProduct', {}, formData);
        
        if (response.success) {
            this.showNotification(response.message || 'Product created successfully!', 'success');
            
            setTimeout(() => {
                this.closeModal();
                window.location.reload();
            }, 1500);
        } else {
            throw new Error(response.error || 'Failed to create product');
        }
    } catch (error) {
        console.error('Error:', error);
        this.showNotification('Error: ' + error.message, 'error');
    } finally {
        this.hideLoading();
    }
};

QuickProductEdit.prototype.updateProductInList = function(productId, updatedData) {
    const row = document.querySelector(`tr input[value="${productId}"]`)?.closest('tr');
    if (!row) return;

    const cells = row.querySelectorAll('td');
    if (cells.length >= 6) {
        if (updatedData.name) cells[2].textContent = updatedData.name;
        if (updatedData.model) cells[3].textContent = updatedData.model;
        if (updatedData.price) cells[4].textContent = updatedData.price;
        if (updatedData.quantity !== undefined) {
            cells[5].textContent = updatedData.quantity;
            cells[5].className = updatedData.quantity <= 0 ? 'text-danger' : '';
        }
        if (updatedData.status !== undefined) {
            cells[6].innerHTML = updatedData.status ? 
                '<span class="text-success">Enabled</span>' : 
                '<span class="text-danger">Disabled</span>';
        }
    }
};
