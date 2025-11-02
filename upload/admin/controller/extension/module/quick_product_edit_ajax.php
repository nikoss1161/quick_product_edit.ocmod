<?php
class ControllerExtensionModuleQuickProductEditAjax extends Controller {
    public function getProductData() {
        $this->load->language('extension/module/quick_product_edit');
        
        $json = array();

        if (!$this->user->hasPermission('modify', 'extension/module/quick_product_edit')) {
            $json['error'] = $this->language->get('error_permission');
            $this->sendJSON($json);
            return;
        }

        if (!isset($this->request->get['product_id'])) {
            $json['error'] = 'Product ID not provided';
            $this->sendJSON($json);
            return;
        }

        $product_id = (int)$this->request->get['product_id'];
        
        $this->load->model('catalog/product');
        $product_info = $this->model_catalog_product->getProduct($product_id);
        
        if (!$product_info) {
            $json['error'] = 'Product not found';
            $this->sendJSON($json);
            return;
        }

        // Основна информация
        $json = $product_info;
        
        // Описания
        $json['product_description'] = $this->model_catalog_product->getProductDescriptions($product_id);
        
        // SEO URL
        $this->load->model('design/seo_url');
        $seo_urls = $this->model_design_seo_url->getSeoUrlsByQuery('product_id=' . $product_id);
        $json['seo_keyword'] = $seo_urls ? $seo_urls[0]['keyword'] : '';
        
        // Категории
        $json['product_category'] = $this->model_catalog_product->getProductCategories($product_id);
        
        // Филтри
        $json['product_filter'] = $this->model_catalog_product->getProductFilters($product_id);
        
        // Атрибути
        $json['product_attribute'] = $this->model_catalog_product->getProductAttributes($product_id);
        
        // Опции
        $json['product_option'] = $this->model_catalog_product->getProductOptions($product_id);
        
        // Свързани продукти
        $json['product_related'] = $this->model_catalog_product->getProductRelated($product_id);
        
        // Изображения
        $json['product_image'] = $this->model_catalog_product->getProductImages($product_id);
        
        // Downloads
        $json['product_download'] = $this->model_catalog_product->getProductDownloads($product_id);
        
        // Stores
        $json['product_store'] = $this->model_catalog_product->getProductStores($product_id);
        
        // Layouts
        $json['product_layout'] = $this->model_catalog_product->getProductLayouts($product_id);
        
        // Recurrings
        $json['product_recurring'] = $this->model_catalog_product->getRecurrings($product_id);

        $json['success'] = true;
        $this->sendJSON($json);
    }

public function updateProduct() {
    $this->load->language('extension/module/quick_product_edit');
    
    $json = array();

    if (!$this->user->hasPermission('modify', 'catalog/product')) {
        $json['error'] = $this->language->get('error_permission');
        $this->sendJSON($json);
        return;
    }

    if (!isset($this->request->get['product_id'])) {
        $json['error'] = 'Product ID not provided';
        $this->sendJSON($json);
        return;
    }

    $product_id = (int)$this->request->get['product_id'];
    
    // ЗАРЕЖДАМЕ ДИРЕКТНО OpenCart МОДЕЛА
    $this->load->model('catalog/product');
    
    // Проверка дали продуктът съществува
    $product_info = $this->model_catalog_product->getProduct($product_id);
    if (!$product_info) {
        $json['error'] = 'Product not found';
        $this->sendJSON($json);
        return;
    }

    try {
        // ЛОГ преди редакция
        $this->log->write('QUICK EDIT UPDATE: Starting update for product ' . $product_id . ' - ' . $product_info['name']);
        
        // ПОДГОТВЯМЕ ДАННИТЕ ПРАВИЛНО
        $product_data = array();
        
        // 1. ОСНОВНИ ПОЛЕТА
        $basic_fields = array('model', 'sku', 'upc', 'ean', 'jan', 'isbn', 'mpn', 'location',
                             'price', 'tax_class_id', 'quantity', 'minimum', 'subtract',
                             'stock_status_id', 'shipping', 'date_available', 'length',
                             'width', 'height', 'length_class_id', 'weight', 'weight_class_id',
                             'status', 'sort_order', 'manufacturer_id');
        
        foreach ($basic_fields as $field) {
            if (isset($this->request->post[$field])) {
                $product_data[$field] = $this->request->post[$field];
            }
        }
        
        // 2. ОПИСАНИЯ - ЗАДЪЛЖИТЕЛНО
        if (isset($this->request->post['product_description'])) {
            $product_data['product_description'] = $this->request->post['product_description'];
        } else {
            // Ако няма описания, взимаме текущите
            $product_data['product_description'] = $this->model_catalog_product->getProductDescriptions($product_id);
        }
        
        // 3. КАТЕГОРИИ
        $product_data['product_category'] = isset($this->request->post['product_category']) ? 
            $this->request->post['product_category'] : 
            $this->model_catalog_product->getProductCategories($product_id);
        
        // 4. МАГАЗИНИ - ЗАДЪЛЖИТЕЛНО
        $product_data['product_store'] = isset($this->request->post['product_store']) ? 
            $this->request->post['product_store'] : 
            array(0);
        
        // 5. ИЗОБРАЖЕНИЕ
        if (isset($this->request->post['image'])) {
            $product_data['image'] = $this->request->post['image'];
        }
        
        $this->log->write('QUICK EDIT UPDATE: Data prepared, calling editProduct...');
        
        // ИЗВИКВАМЕ ДИРЕКТНО OpenCart МЕТОДА
        $this->model_catalog_product->editProduct($product_id, $product_data);
        
        // Проверка дали продуктът все още съществува
        $updated_product = $this->model_catalog_product->getProduct($product_id);
        if (!$updated_product) {
            throw new Exception('Product was deleted during update!');
        }
        
        $json['success'] = true;
        $json['message'] = $this->language->get('text_save_success');
        $json['product_id'] = $product_id;
        
        // Връщаме актуализирани данни
        $json['updated_data'] = array(
            'name' => $updated_product['name'],
            'model' => $updated_product['model'],
            'price' => $updated_product['price'],
            'quantity' => $updated_product['quantity'],
            'status' => $updated_product['status']
        );
        
        $this->log->write('QUICK EDIT UPDATE: Successfully updated product ' . $product_id);
        
    } catch (Exception $e) {
        $json['error'] = $e->getMessage();
        $this->log->write('QUICK EDIT UPDATE ERROR: ' . $e->getMessage());
    }

    $this->sendJSON($json);
}

private function prepareProductData($post_data) {
    $data = array();
    
    // Основни полета на продукта
    $basic_fields = array(
        'model', 'sku', 'upc', 'ean', 'jan', 'isbn', 'mpn', 'location',
        'price', 'tax_class_id', 'quantity', 'minimum', 'subtract',
        'stock_status_id', 'shipping', 'date_available', 'length',
        'width', 'height', 'length_class_id', 'weight', 'weight_class_id',
        'status', 'sort_order', 'manufacturer_id'
    );
    
    foreach ($basic_fields as $field) {
        if (isset($post_data[$field])) {
            $data[$field] = $post_data[$field];
        }
    }
    
    // Снимка
    if (isset($post_data['image'])) {
        $data['image'] = $post_data['image'];
    }
    
    // Описания - КРИТИЧНО ВАЖНО
    if (isset($post_data['product_description']) && is_array($post_data['product_description'])) {
        $data['product_description'] = array();
        foreach ($post_data['product_description'] as $language_id => $description) {
            $data['product_description'][$language_id] = array(
                'name' => $description['name'] ?? '',
                'description' => $description['description'] ?? '',
                'meta_title' => $description['meta_title'] ?? '',
                'meta_description' => $description['meta_description'] ?? '',
                'meta_keyword' => $description['meta_keyword'] ?? '',
                'tag' => $description['tag'] ?? ''
            );
        }
    }
    
    // Категории
    $data['product_category'] = isset($post_data['product_category']) ? $post_data['product_category'] : array();
    
    // Филтри
    $data['product_filter'] = isset($post_data['product_filter']) ? $post_data['product_filter'] : array();
    
    // Магазини
    $data['product_store'] = isset($post_data['product_store']) ? $post_data['product_store'] : array(0);
    
    // Downloads
    $data['product_download'] = isset($post_data['product_download']) ? $post_data['product_download'] : array();
    
    // Свързани продукти
    $data['product_related'] = isset($post_data['product_related']) ? $post_data['product_related'] : array();
    
    // Атрибути - поправка за структурата
    $data['product_attribute'] = array();
    if (isset($post_data['product_attribute']) && is_array($post_data['product_attribute'])) {
        foreach ($post_data['product_attribute'] as $attribute) {
            if (isset($attribute['attribute_id']) && $attribute['attribute_id'] && isset($attribute['text'])) {
                $data['product_attribute'][] = array(
                    'attribute_id' => $attribute['attribute_id'],
                    'product_attribute_description' => array(
                        (int)$this->config->get('config_language_id') => array(
                            'text' => $attribute['text']
                        )
                    )
                );
            }
        }
    }
    
    // Опции - опростена версия първоначално
    $data['product_option'] = array();
    if (isset($post_data['product_option']) && is_array($post_data['product_option'])) {
        foreach ($post_data['product_option'] as $index => $option) {
            if (!empty($option['option_id'])) {
                $option_data = array(
                    'option_id' => $option['option_id'],
                    'required' => $option['required'] ?? 0,
                    'value' => $option['value'] ?? ''
                );
                
                // Стойности на опциите
                if (isset($option['option_value']) && is_array($option['option_value'])) {
                    $option_data['product_option_value'] = array();
                    foreach ($option['option_value'] as $value_index => $option_value) {
                        if (!empty($option_value['option_value_id'])) {
                            $option_data['product_option_value'][] = array(
                                'option_value_id' => $option_value['option_value_id'],
                                'quantity' => $option_value['quantity'] ?? 0,
                                'subtract' => $option_value['subtract'] ?? 0,
                                'price' => $option_value['price'] ?? 0,
                                'price_prefix' => $option_value['price_prefix'] ?? '+',
                                'points' => $option_value['points'] ?? 0,
                                'points_prefix' => $option_value['points_prefix'] ?? '+',
                                'weight' => $option_value['weight'] ?? 0,
                                'weight_prefix' => $option_value['weight_prefix'] ?? '+'
                            );
                        }
                    }
                }
                
                $data['product_option'][] = $option_data;
            }
        }
    }
    
    // Допълнителни снимки
    $data['product_image'] = array();
    if (isset($post_data['product_image']) && is_array($post_data['product_image'])) {
        foreach ($post_data['product_image'] as $image) {
            if (!empty($image['image'])) {
                $data['product_image'][] = array(
                    'image' => $image['image'],
                    'sort_order' => $image['sort_order'] ?? 0
                );
            }
        }
    }
    
    // Специални цени
    $data['product_special'] = array();
    if (isset($post_data['product_special']) && is_array($post_data['product_special'])) {
        foreach ($post_data['product_special'] as $special) {
            if (!empty($special['price'])) {
                $data['product_special'][] = array(
                    'customer_group_id' => 1, // Default customer group
                    'priority' => $special['priority'] ?? 1,
                    'price' => $special['price'],
                    'date_start' => $special['date_start'] ?? date('Y-m-d'),
                    'date_end' => $special['date_end'] ?? ''
                );
            }
        }
    }
    
    // SEO URL
    if (!empty($post_data['seo_keyword'])) {
        $data['product_seo_url'] = array(
            0 => array( // store_id 0
                'keyword' => $post_data['seo_keyword']
            )
        );
    }
    
    return $data;
}

    public function createProduct() {
        $this->load->language('extension/module/quick_product_edit');
        
        $json = array();

        if (!$this->user->hasPermission('modify', 'extension/module/quick_product_edit')) {
            $json['error'] = $this->language->get('error_permission');
            $this->sendJSON($json);
            return;
        }

        $this->load->model('extension/module/quick_product_edit');
        
        try {
            $product_id = $this->model_extension_module_quick_product_edit->addProduct($this->request->post);
            $json['success'] = true;
            $json['message'] = 'Product created successfully!';
            $json['product_id'] = $product_id;
            
        } catch (Exception $e) {
            $json['error'] = $e->getMessage();
        }

        $this->sendJSON($json);
    }

public function getFieldData() {
    $this->load->language('extension/module/quick_product_edit');
    
    $json = array();

    if (!$this->user->hasPermission('modify', 'extension/module/quick_product_edit')) {
        $json['error'] = $this->language->get('error_permission');
        $this->sendJSON($json);
        return;
    }
    
    $this->load->model('extension/module/quick_product_edit');
    
    $json['stock_statuses'] = $this->model_extension_module_quick_product_edit->getStockStatuses();
    $json['weight_classes'] = $this->model_extension_module_quick_product_edit->getWeightClasses();
    $json['length_classes'] = $this->model_extension_module_quick_product_edit->getLengthClasses();
    $json['manufacturers'] = $this->model_extension_module_quick_product_edit->getManufacturers();
    $json['tax_classes'] = $this->model_extension_module_quick_product_edit->getTaxClasses();
    $json['languages'] = $this->model_extension_module_quick_product_edit->getLanguages();
    $json['categories'] = $this->model_extension_module_quick_product_edit->getCategories();
    $json['filters'] = $this->model_extension_module_quick_product_edit->getFilters();
    $json['attribute_groups'] = $this->model_extension_module_quick_product_edit->getAttributeGroups();
    $json['options'] = $this->model_extension_module_quick_product_edit->getOptions();
    $json['downloads'] = $this->model_extension_module_quick_product_edit->getDownloads();
    $json['stores'] = $this->model_extension_module_quick_product_edit->getStores();
    $json['layouts'] = $this->model_extension_module_quick_product_edit->getLayouts();
    
    // Get all attributes for each group
    foreach ($json['attribute_groups'] as &$group) {
        $group['attributes'] = $this->model_extension_module_quick_product_edit->getAttributes($group['attribute_group_id']);
    }
    
    // Get all option values for each option
    foreach ($json['options'] as &$option) {
        $option['values'] = $this->model_extension_module_quick_product_edit->getOptionValues($option['option_id']);
    }
    
    $json['success'] = true;
    $this->sendJSON($json);
}

    private function sendJSON($data) {
        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($data));
    }
}