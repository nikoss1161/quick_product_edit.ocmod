<?php
class ControllerExtensionModuleQuickProductEditAjax extends Controller {
    public function getProductData() {
        // CRITICAL: Disable output buffering and error display for clean JSON
        @ini_set('display_errors', 0);
        error_reporting(0);
        
        $this->load->language('extension/module/quick_product_edit');
        
        $json = array();

        try {
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

            // Basic info
            $json = $product_info;
            
            // Descriptions
            $json['product_description'] = $this->model_catalog_product->getProductDescriptions($product_id);
            
            // SEO URL - with error handling
            try {
                $this->load->model('design/seo_url');
                $seo_urls = $this->model_design_seo_url->getSeoUrlsByQuery('product_id=' . $product_id);
                $json['seo_keyword'] = array();
                foreach ($seo_urls as $seo_url) {
                    $json['seo_keyword'][$seo_url['store_id']] = $seo_url['keyword'];
                }
            } catch (Exception $e) {
                $json['seo_keyword'] = array();
            }
            
            // Categories
            $json['product_category'] = $this->model_catalog_product->getProductCategories($product_id);
            
            // Filters
            $json['product_filter'] = $this->model_catalog_product->getProductFilters($product_id);
            
            // Attributes
            $json['product_attribute'] = $this->model_catalog_product->getProductAttributes($product_id);
            
            // Options
            $json['product_option'] = $this->model_catalog_product->getProductOptions($product_id);
            
            // Related products
            $json['product_related'] = $this->model_catalog_product->getProductRelated($product_id);
            
            // Images
            $json['product_image'] = $this->model_catalog_product->getProductImages($product_id);
            
            // Downloads
            $json['product_download'] = $this->model_catalog_product->getProductDownloads($product_id);
            
            // Stores
            $json['product_store'] = $this->model_catalog_product->getProductStores($product_id);
            
            // Layouts
            $json['product_layout'] = $this->model_catalog_product->getProductLayouts($product_id);
            
            // Recurrings
            $json['product_recurring'] = $this->model_catalog_product->getRecurrings($product_id);
            
            // Special prices
            $json['product_special'] = $this->model_catalog_product->getProductSpecials($product_id);
            
            // Discounts
            $json['product_discount'] = $this->model_catalog_product->getProductDiscounts($product_id);
            
            // Reward points
            $json['product_reward'] = $this->model_catalog_product->getProductRewards($product_id);

            $json['success'] = true;
            
        } catch (Exception $e) {
            $json['success'] = false;
            $json['error'] = 'Error loading product data: ' . $e->getMessage();
            $this->log->write('QUICK EDIT ERROR: ' . $e->getMessage());
        }
        
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
        
        $this->load->model('catalog/product');
        
        $product_info = $this->model_catalog_product->getProduct($product_id);
        if (!$product_info) {
            $json['error'] = 'Product not found';
            $this->sendJSON($json);
            return;
        }

        try {
            $this->log->write('QUICK EDIT: Updating product ' . $product_id);
            
            // Prepare product data
            $product_data = $this->prepareProductData($this->request->post, $product_id);
            
            // Update product
            $this->model_catalog_product->editProduct($product_id, $product_data);
            
            // Verify update
            $updated_product = $this->model_catalog_product->getProduct($product_id);
            if (!$updated_product) {
                throw new Exception('Product was deleted during update!');
            }
            
            $json['success'] = true;
            $json['message'] = $this->language->get('text_save_success');
            $json['product_id'] = $product_id;
            
            // Return updated data
            $json['updated_data'] = array(
                'name' => $updated_product['name'],
                'model' => $updated_product['model'],
                'price' => $updated_product['price'],
                'quantity' => $updated_product['quantity'],
                'status' => $updated_product['status']
            );
            
            $this->log->write('QUICK EDIT: Successfully updated product ' . $product_id);
            
        } catch (Exception $e) {
            $json['error'] = $e->getMessage();
            $this->log->write('QUICK EDIT ERROR: ' . $e->getMessage());
        }

        $this->sendJSON($json);
    }

    public function createProduct() {
        $this->load->language('extension/module/quick_product_edit');
        
        $json = array();

        if (!$this->user->hasPermission('modify', 'catalog/product')) {
            $json['error'] = $this->language->get('error_permission');
            $this->sendJSON($json);
            return;
        }

        $this->load->model('catalog/product');
        
        try {
            $product_data = $this->prepareProductData($this->request->post);
            $product_id = $this->model_catalog_product->addProduct($product_data);
            
            $json['success'] = true;
            $json['message'] = 'Product created successfully!';
            $json['product_id'] = $product_id;
            
        } catch (Exception $e) {
            $json['error'] = $e->getMessage();
            $this->log->write('QUICK CREATE ERROR: ' . $e->getMessage());
        }

        $this->sendJSON($json);
    }

    private function prepareProductData($post_data, $product_id = null) {
        $data = array();
        
        // Basic fields
        $basic_fields = array(
            'model', 'sku', 'upc', 'ean', 'jan', 'isbn', 'mpn', 'location',
            'price', 'tax_class_id', 'quantity', 'minimum', 'subtract',
            'stock_status_id', 'shipping', 'date_available', 'length',
            'width', 'height', 'length_class_id', 'weight', 'weight_class_id',
            'status', 'sort_order', 'manufacturer_id', 'points'
        );
        
        foreach ($basic_fields as $field) {
            if (isset($post_data[$field])) {
                $data[$field] = $post_data[$field];
            } else {
                // Set defaults for required fields
                if ($field == 'status') $data[$field] = 1;
                elseif ($field == 'quantity') $data[$field] = 0;
                elseif ($field == 'minimum') $data[$field] = 1;
                elseif ($field == 'subtract') $data[$field] = 1;
                elseif ($field == 'shipping') $data[$field] = 1;
                elseif ($field == 'sort_order') $data[$field] = 0;
                elseif ($field == 'weight_class_id') $data[$field] = 1;
                elseif ($field == 'length_class_id') $data[$field] = 1;
                elseif ($field == 'stock_status_id') $data[$field] = 5;
                elseif ($field == 'tax_class_id') $data[$field] = 0;
                else $data[$field] = '';
            }
        }
        
        // Image
        $data['image'] = isset($post_data['image']) ? $post_data['image'] : '';
        
        // Descriptions - REQUIRED
        if (isset($post_data['product_description']) && is_array($post_data['product_description'])) {
            $data['product_description'] = array();
            foreach ($post_data['product_description'] as $language_id => $description) {
                $data['product_description'][$language_id] = array(
                    'name' => isset($description['name']) ? $description['name'] : '',
                    'description' => isset($description['description']) ? $description['description'] : '',
                    'meta_title' => isset($description['meta_title']) ? $description['meta_title'] : (isset($description['name']) ? $description['name'] : ''),
                    'meta_description' => isset($description['meta_description']) ? $description['meta_description'] : '',
                    'meta_keyword' => isset($description['meta_keyword']) ? $description['meta_keyword'] : '',
                    'tag' => isset($description['tag']) ? $description['tag'] : ''
                );
            }
        } elseif ($product_id) {
            // Get existing descriptions if updating
            $this->load->model('catalog/product');
            $data['product_description'] = $this->model_catalog_product->getProductDescriptions($product_id);
        } else {
            // Default for new product
            $data['product_description'] = array(
                (int)$this->config->get('config_language_id') => array(
                    'name' => 'New Product',
                    'description' => '',
                    'meta_title' => 'New Product',
                    'meta_description' => '',
                    'meta_keyword' => '',
                    'tag' => ''
                )
            );
        }
        
        // Categories
        $data['product_category'] = isset($post_data['product_category']) ? $post_data['product_category'] : array();
        
        // Filters
        $data['product_filter'] = isset($post_data['product_filter']) ? $post_data['product_filter'] : array();
        
        // Stores - REQUIRED
        $data['product_store'] = isset($post_data['product_store']) ? $post_data['product_store'] : array(0);
        
        // Downloads
        $data['product_download'] = isset($post_data['product_download']) ? $post_data['product_download'] : array();
        
        // Related products
        if (isset($post_data['product_related'])) {
            $data['product_related'] = $post_data['product_related'];
        } elseif (isset($post_data['product_related_input'])) {
            $related_input = $post_data['product_related_input'];
            $data['product_related'] = array_filter(array_map('trim', explode(',', $related_input)));
        } else {
            $data['product_related'] = array();
        }
        
        // Attributes - FIXED
        $data['product_attribute'] = array();
        if (isset($post_data['product_attribute']) && is_array($post_data['product_attribute'])) {
            foreach ($post_data['product_attribute'] as $attribute) {
                if (isset($attribute['attribute_id']) && $attribute['attribute_id']) {
                    $attribute_data = array(
                        'attribute_id' => $attribute['attribute_id']
                    );
                    
                    // Handle text - it can be direct or in product_attribute_description array
                    if (isset($attribute['product_attribute_description']) && is_array($attribute['product_attribute_description'])) {
                        $attribute_data['product_attribute_description'] = $attribute['product_attribute_description'];
                    } elseif (isset($attribute['text'])) {
                        $language_id = isset($attribute['language_id']) ? $attribute['language_id'] : (int)$this->config->get('config_language_id');
                        $attribute_data['product_attribute_description'] = array(
                            $language_id => array('text' => $attribute['text'])
                        );
                    }
                    
                    $data['product_attribute'][] = $attribute_data;
                }
            }
        }
        
        // Options - FIXED
        $data['product_option'] = array();
        if (isset($post_data['product_option']) && is_array($post_data['product_option'])) {
            foreach ($post_data['product_option'] as $product_option) {
                if (!empty($product_option['option_id'])) {
                    $option_data = array(
                        'product_option_id' => isset($product_option['product_option_id']) ? $product_option['product_option_id'] : 0,
                        'option_id' => $product_option['option_id'],
                        'required' => isset($product_option['required']) ? $product_option['required'] : 0,
                        'value' => isset($product_option['value']) ? $product_option['value'] : ''
                    );
                    
                    // Option values
                    if (isset($product_option['product_option_value']) && is_array($product_option['product_option_value'])) {
                        $option_data['product_option_value'] = array();
                        foreach ($product_option['product_option_value'] as $option_value) {
                            if (!empty($option_value['option_value_id'])) {
                                $option_data['product_option_value'][] = array(
                                    'product_option_value_id' => isset($option_value['product_option_value_id']) ? $option_value['product_option_value_id'] : 0,
                                    'option_value_id' => $option_value['option_value_id'],
                                    'quantity' => isset($option_value['quantity']) ? $option_value['quantity'] : 0,
                                    'subtract' => isset($option_value['subtract']) ? $option_value['subtract'] : 0,
                                    'price' => isset($option_value['price']) ? $option_value['price'] : 0,
                                    'price_prefix' => isset($option_value['price_prefix']) ? $option_value['price_prefix'] : '+',
                                    'points' => isset($option_value['points']) ? $option_value['points'] : 0,
                                    'points_prefix' => isset($option_value['points_prefix']) ? $option_value['points_prefix'] : '+',
                                    'weight' => isset($option_value['weight']) ? $option_value['weight'] : 0,
                                    'weight_prefix' => isset($option_value['weight_prefix']) ? $option_value['weight_prefix'] : '+'
                                );
                            }
                        }
                    }
                    
                    $data['product_option'][] = $option_data;
                }
            }
        }
        
        // Additional images
        $data['product_image'] = array();
        if (isset($post_data['product_image']) && is_array($post_data['product_image'])) {
            foreach ($post_data['product_image'] as $image) {
                if (!empty($image['image'])) {
                    $data['product_image'][] = array(
                        'image' => $image['image'],
                        'sort_order' => isset($image['sort_order']) ? $image['sort_order'] : 0
                    );
                }
            }
        }
        
        // Special prices - FIXED
        $data['product_special'] = array();
        if (isset($post_data['product_special']) && is_array($post_data['product_special'])) {
            foreach ($post_data['product_special'] as $special) {
                if (!empty($special['price'])) {
                    $data['product_special'][] = array(
                        'customer_group_id' => isset($special['customer_group_id']) ? $special['customer_group_id'] : $this->config->get('config_customer_group_id'),
                        'priority' => isset($special['priority']) ? $special['priority'] : 1,
                        'price' => $special['price'],
                        'date_start' => isset($special['date_start']) ? $special['date_start'] : date('Y-m-d'),
                        'date_end' => isset($special['date_end']) ? $special['date_end'] : '0000-00-00'
                    );
                }
            }
        }
            elseif (isset($post_data['special_price']) && $post_data['special_price']) {
            // Single special price from quick edit form
            $data['product_special'][] = array(
                'customer_group_id' => $this->config->get('config_customer_group_id'),
                'priority' => 1,
                'price' => $post_data['special_price'],
                'date_start' => date('Y-m-d'),
                'date_end' => '0000-00-00'
            );
        }
        
        // Discounts
        $data['product_discount'] = array();
        if (isset($post_data['product_discount']) && is_array($post_data['product_discount'])) {
            $data['product_discount'] = $post_data['product_discount'];
        }
        
        // Reward points
        $data['product_reward'] = array();
        if (isset($post_data['product_reward']) && is_array($post_data['product_reward'])) {
            $data['product_reward'] = $post_data['product_reward'];
        }
        
        // SEO URL
        $data['product_seo_url'] = array();
        if (isset($post_data['seo_keyword'])) {
            $data['product_seo_url'][0] = array(
                (int)$this->config->get('config_language_id') => $post_data['seo_keyword']
            );
        }
        
        // Layouts
        $data['product_layout'] = array();
        if (isset($post_data['product_layout']) && is_array($post_data['product_layout'])) {
            $data['product_layout'] = $post_data['product_layout'];
        }
        
        // Recurring
        $data['product_recurring'] = array();
        if (isset($post_data['product_recurring']) && is_array($post_data['product_recurring'])) {
            $data['product_recurring'] = $post_data['product_recurring'];
        }
        
        return $data;
    }

    public function getFieldData() {
        // CRITICAL: Disable output buffering and error display for clean JSON
        @ini_set('display_errors', 0);
        error_reporting(0);
        
        $this->load->language('extension/module/quick_product_edit');
        
        $json = array();

        try {
            if (!$this->user->hasPermission('modify', 'extension/module/quick_product_edit')) {
                $json['error'] = $this->language->get('error_permission');
                $this->sendJSON($json);
                return;
            }
            
            // Load the model
            $this->load->model('extension/module/quick_product_edit');
            
            // Get all field data
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
            
            // Get attributes for each group
            foreach ($json['attribute_groups'] as &$group) {
                $group['attributes'] = $this->model_extension_module_quick_product_edit->getAttributes($group['attribute_group_id']);
            }
            
            // Get option values for each option
            foreach ($json['options'] as &$option) {
                $option['values'] = $this->model_extension_module_quick_product_edit->getOptionValues($option['option_id']);
            }
            
            $json['success'] = true;
            
        } catch (Exception $e) {
            $json['success'] = false;
            $json['error'] = 'Error loading field data: ' . $e->getMessage();
            $this->log->write('QUICK EDIT FIELD DATA ERROR: ' . $e->getMessage());
        }
        
        $this->sendJSON($json);
    }

    private function sendJSON($data) {
        // Clear any previous output
        if (ob_get_level()) {
            ob_end_clean();
        }
        
        $this->response->addHeader('Content-Type: application/json');
        $this->response->setOutput(json_encode($data));
    }
}
