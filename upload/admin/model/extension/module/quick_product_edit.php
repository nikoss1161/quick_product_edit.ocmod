<?php
class ModelExtensionModuleQuickProductEdit extends Model {
    
    public function install() {
        // Create settings table if needed
        $this->db->query("
            CREATE TABLE IF NOT EXISTS `" . DB_PREFIX . "quick_product_edit_settings` (
                `user_id` int(11) NOT NULL,
                `visible_fields` text NOT NULL,
                `updated` datetime NOT NULL,
                PRIMARY KEY (`user_id`)
            ) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
        ");
    }

    public function uninstall() {
        // Remove settings table if needed
        // $this->db->query("DROP TABLE IF EXISTS `" . DB_PREFIX . "quick_product_edit_settings`");
    }

    public function addProduct($data) {
        $this->load->model('catalog/product');
        return $this->model_catalog_product->addProduct($data);
    }

    public function editProduct($product_id, $data) {
        // ВАЖНО: Използваме editProduct вместо updateProduct
        $this->load->model('catalog/product');
        $this->model_catalog_product->editProduct($product_id, $data);
        return true;
    }

    public function getStockStatuses() {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "stock_status WHERE language_id = '" . (int)$this->config->get('config_language_id') . "' ORDER BY name");
        return $query->rows;
    }

    public function getWeightClasses() {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "weight_class wc LEFT JOIN " . DB_PREFIX . "weight_class_description wcd ON (wc.weight_class_id = wcd.weight_class_id) WHERE wcd.language_id = '" . (int)$this->config->get('config_language_id') . "'");
        return $query->rows;
    }

    public function getLengthClasses() {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "length_class lc LEFT JOIN " . DB_PREFIX . "length_class_description lcd ON (lc.length_class_id = lcd.length_class_id) WHERE lcd.language_id = '" . (int)$this->config->get('config_language_id') . "'");
        return $query->rows;
    }

    public function getManufacturers() {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "manufacturer ORDER BY name");
        return $query->rows;
    }

    public function getTaxClasses() {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "tax_class ORDER BY title");
        return $query->rows;
    }

    public function getLanguages() {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "language WHERE status = '1' ORDER BY sort_order, name");
        return $query->rows;
    }

    public function getCategories($data = array()) {
        $sql = "SELECT cp.category_id AS category_id, GROUP_CONCAT(cd1.name ORDER BY cp.level SEPARATOR ' &gt; ') AS name, c.parent_id, c.sort_order FROM " . DB_PREFIX . "category_path cp LEFT JOIN " . DB_PREFIX . "category c ON (cp.path_id = c.category_id) LEFT JOIN " . DB_PREFIX . "category_description cd1 ON (c.category_id = cd1.category_id) WHERE cd1.language_id = '" . (int)$this->config->get('config_language_id') . "'";

        if (!empty($data['filter_name'])) {
            $sql .= " AND cd1.name LIKE '" . $this->db->escape($data['filter_name']) . "%'";
        }

        $sql .= " GROUP BY cp.category_id";

        $sort_data = array(
            'name',
            'sort_order'
        );

        if (isset($data['sort']) && in_array($data['sort'], $sort_data)) {
            $sql .= " ORDER BY " . $data['sort'];
        } else {
            $sql .= " ORDER BY name";
        }

        if (isset($data['order']) && ($data['order'] == 'DESC')) {
            $sql .= " DESC";
        } else {
            $sql .= " ASC";
        }

        if (isset($data['start']) || isset($data['limit'])) {
            if ($data['start'] < 0) {
                $data['start'] = 0;
            }

            if ($data['limit'] < 1) {
                $data['limit'] = 20;
            }

            $sql .= " LIMIT " . (int)$data['start'] . "," . (int)$data['limit'];
        }

        $query = $this->db->query($sql);

        return $query->rows;
    }

    public function getFilters() {
        $query = $this->db->query("SELECT *, (SELECT name FROM " . DB_PREFIX . "filter_group_description fgd WHERE f.filter_group_id = fgd.filter_group_id AND fgd.language_id = '" . (int)$this->config->get('config_language_id') . "') AS `group` FROM " . DB_PREFIX . "filter f LEFT JOIN " . DB_PREFIX . "filter_description fd ON (f.filter_id = fd.filter_id) WHERE fd.language_id = '" . (int)$this->config->get('config_language_id') . "' ORDER BY f.sort_order ASC");
        return $query->rows;
    }

    public function getAttributeGroups() {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "attribute_group ag LEFT JOIN " . DB_PREFIX . "attribute_group_description agd ON (ag.attribute_group_id = agd.attribute_group_id) WHERE agd.language_id = '" . (int)$this->config->get('config_language_id') . "' ORDER BY ag.sort_order, agd.name");
        return $query->rows;
    }

    public function getAttributes($attribute_group_id) {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "attribute a LEFT JOIN " . DB_PREFIX . "attribute_description ad ON (a.attribute_id = ad.attribute_id) WHERE a.attribute_group_id = '" . (int)$attribute_group_id . "' AND ad.language_id = '" . (int)$this->config->get('config_language_id') . "' ORDER BY a.sort_order, ad.name");
        return $query->rows;
    }

    public function getOptions() {
        $query = $this->db->query("SELECT * FROM `" . DB_PREFIX . "option` o LEFT JOIN " . DB_PREFIX . "option_description od ON (o.option_id = od.option_id) WHERE od.language_id = '" . (int)$this->config->get('config_language_id') . "' ORDER BY o.sort_order");
        return $query->rows;
    }

    public function getOptionValues($option_id) {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "option_value ov LEFT JOIN " . DB_PREFIX . "option_value_description ovd ON (ov.option_value_id = ovd.option_value_id) WHERE ov.option_id = '" . (int)$option_id . "' AND ovd.language_id = '" . (int)$this->config->get('config_language_id') . "' ORDER BY ov.sort_order, ovd.name");
        return $query->rows;
    }

    public function getDownloads() {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "download d LEFT JOIN " . DB_PREFIX . "download_description dd ON (d.download_id = dd.download_id) WHERE dd.language_id = '" . (int)$this->config->get('config_language_id') . "' ORDER BY d.date_added DESC");
        return $query->rows;
    }

    public function getStores() {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "store ORDER BY url");
        return $query->rows;
    }

    public function getLayouts() {
        $query = $this->db->query("SELECT * FROM " . DB_PREFIX . "layout ORDER BY name");
        return $query->rows;
    }

    public function saveUserSettings($user_id, $visible_fields) {
        $this->db->query("
            REPLACE INTO `" . DB_PREFIX . "quick_product_edit_settings` 
            SET `user_id` = '" . (int)$user_id . "', 
                `visible_fields` = '" . $this->db->escape(json_encode($visible_fields)) . "',
                `updated` = NOW()
        ");
    }

    public function getUserSettings($user_id) {
        $query = $this->db->query("SELECT * FROM `" . DB_PREFIX . "quick_product_edit_settings` WHERE `user_id` = '" . (int)$user_id . "'");
        
        if ($query->num_rows) {
            return json_decode($query->row['visible_fields'], true);
        }
        
        return array();
    }
}
