<?php
class ControllerExtensionModuleQuickProductEdit extends Controller {
    private $error = array();

    public function index() {
        $this->load->language('extension/module/quick_product_edit');

        $this->document->setTitle($this->language->get('heading_title'));

        $this->load->model('setting/setting');

        if (($this->request->server['REQUEST_METHOD'] == 'POST') && $this->validate()) {
            $this->model_setting_setting->editSetting('module_quick_product_edit', $this->request->post);

            $this->session->data['success'] = $this->language->get('text_success');

            $this->response->redirect($this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true));
        }

        // Set language texts
        $data['heading_title'] = $this->language->get('heading_title');
        $data['text_edit'] = $this->language->get('text_edit');
        $data['text_enabled'] = $this->language->get('text_enabled');
        $data['text_disabled'] = $this->language->get('text_disabled');
        $data['entry_status'] = $this->language->get('entry_status');
        $data['button_save'] = $this->language->get('button_save');
        $data['button_cancel'] = $this->language->get('button_cancel');

        // Error handling
        if (isset($this->error['warning'])) {
            $data['error_warning'] = $this->error['warning'];
        } else {
            $data['error_warning'] = '';
        }

        // Success message
        if (isset($this->session->data['success'])) {
            $data['success'] = $this->session->data['success'];
            unset($this->session->data['success']);
        } else {
            $data['success'] = '';
        }

        // Breadcrumbs
        $data['breadcrumbs'] = array();

        $data['breadcrumbs'][] = array(
            'text' => $this->language->get('text_home'),
            'href' => $this->url->link('common/dashboard', 'user_token=' . $this->session->data['user_token'], true)
        );

        $data['breadcrumbs'][] = array(
            'text' => $this->language->get('text_extension'),
            'href' => $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true)
        );

        $data['breadcrumbs'][] = array(
            'text' => $this->language->get('heading_title'),
            'href' => $this->url->link('extension/module/quick_product_edit', 'user_token=' . $this->session->data['user_token'], true)
        );

        // Action links
        $data['action'] = $this->url->link('extension/module/quick_product_edit', 'user_token=' . $this->session->data['user_token'], true);
        $data['cancel'] = $this->url->link('marketplace/extension', 'user_token=' . $this->session->data['user_token'] . '&type=module', true);

        // Module settings
        if (isset($this->request->post['module_quick_product_edit_status'])) {
            $data['module_quick_product_edit_status'] = $this->request->post['module_quick_product_edit_status'];
        } else {
            $data['module_quick_product_edit_status'] = $this->config->get('module_quick_product_edit_status');
        }

        // Add CSS and JavaScript
        $this->document->addStyle('view/javascript/quick_product_edit/quick_product_edit.css');
        $this->document->addScript('view/javascript/quick_product_edit/quick_product_edit.js');

        // Load template parts
        $data['header'] = $this->load->controller('common/header');
        $data['column_left'] = $this->load->controller('common/column_left');
        $data['footer'] = $this->load->controller('common/footer');

        $this->response->setOutput($this->load->view('extension/module/quick_product_edit', $data));
    }

    protected function validate() {
        if (!$this->user->hasPermission('modify', 'extension/module/quick_product_edit')) {
            $this->error['warning'] = $this->language->get('error_permission');
        }

        return !$this->error;
    }

    public function install() {
        $this->load->model('setting/event');
        
        // Add event to inject scripts in product list
        $this->model_setting_event->addEvent(
            'quick_product_edit', 
            'admin/view/catalog/product_list/after', 
            'extension/module/quick_product_edit/injectScripts'
        );
        
        // Enable module by default
        $this->load->model('setting/setting');
        $this->model_setting_setting->editSetting('module_quick_product_edit', array(
            'module_quick_product_edit_status' => 1
        ));
    }

    public function uninstall() {
        $this->load->model('setting/event');
        $this->model_setting_event->deleteEventByCode('quick_product_edit');
    }

public function injectScripts(&$route, &$data, &$output) {
    // Only inject if module is enabled and we're on product list page
    if ($this->config->get('module_quick_product_edit_status')) {
        $current_route = isset($this->request->get['route']) ? $this->request->get['route'] : '';
        
        // Inject only on product list page
        if ($current_route == 'catalog/product') {
            $this->load->language('extension/module/quick_product_edit');
            
            // Prepare translations for JavaScript
            $translations = [
                'text_quick_edit' => $this->language->get('text_quick_edit'),
                'text_quick_create' => $this->language->get('text_quick_create'),
                'text_field_visibility' => $this->language->get('text_field_visibility'),
                'text_fullscreen' => $this->language->get('text_fullscreen'),
                'text_exit_fullscreen' => $this->language->get('text_exit_fullscreen'),
                'text_save_success' => $this->language->get('text_save_success'),
                'text_save_error' => $this->language->get('text_save_error'),
                'text_loading' => $this->language->get('text_loading'),
                'button_save' => $this->language->get('button_save'),
                'button_cancel' => $this->language->get('button_cancel'),
                'button_close' => $this->language->get('button_close'),
                // ... add all other translations
            ];
            
            $script = "
            <script>
            if (typeof window.quickEditTexts === 'undefined') {
                window.quickEditTexts = " . json_encode($translations) . ";
            }
            </script>
            <link rel=\"stylesheet\" type=\"text/css\" href=\"view/javascript/quick_product_edit/quick_product_edit.css\" />
            <script src=\"view/javascript/quick_product_edit/quick_product_edit.js\"></script>
            ";
            
            // Inject before closing body tag
            $output = str_replace('</body>', $script . '</body>', $output);
        }
    }
}

    // Helper method to get AJAX URL
    public function getAjaxUrl($action) {
        return $this->url->link('extension/module/quick_product_edit_ajax/' . $action, 'user_token=' . $this->session->data['user_token'], true);
    }
}
