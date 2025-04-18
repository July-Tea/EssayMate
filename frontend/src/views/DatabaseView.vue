<template>
  <div class="database-view">
    <div class="header-container">
      <h1 class="title">数据库浏览</h1>
      <el-button 
        class="home-button" 
        type="primary" 
        round 
        @click="goToHome"
        :icon="HomeFilled"
      >
        回到首页
      </el-button>
    </div>
    
    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="10" animated />
    </div>
    
    <div v-else-if="error" class="error-container">
      <el-alert
        :title="error"
        type="error"
        :closable="false"
        show-icon
      />
      <el-button class="retry-button" type="primary" @click="fetchDatabaseInfo">
        重试
      </el-button>
    </div>
    
    <div v-else class="database-content">
      <el-tabs v-model="activeTable" type="border-card" class="table-tabs">
        <el-tab-pane 
          v-for="tableName in tables" 
          :key="tableName" 
          :label="tableName" 
          :name="tableName"
        >
          <div class="table-info">
            <div class="table-header">
              <h3>{{ tableName }}</h3>
              <div class="table-actions">
                <el-input 
                  v-model="searchInputs[tableName]" 
                  placeholder="搜索..." 
                  clearable 
                  prefix-icon="el-icon-search"
                  class="search-input"
                  @input="handleSearch(tableName)"
                />
                <el-button 
                  type="primary" 
                  plain 
                  size="small" 
                  @click="exportTable(tableName)"
                >
                  导出
                </el-button>
              </div>
            </div>
            
            <div class="table-container">
              <el-table
                :data="filteredData[tableName] || []"
                border
                stripe
                style="width: 100%"
                max-height="600px"
                :default-sort="{ prop: tablesData[tableName]?.columns[0]?.name, order: 'ascending' }"
              >
                <el-table-column
                  v-for="column in tablesData[tableName]?.columns"
                  :key="column.name"
                  :prop="column.name"
                  :label="column.name"
                  sortable
                  :width="getColumnWidth(column)"
                >
                  <template #default="scope">
                    <div class="cell-content" :class="{ 'json-content': isJson(scope.row[column.name]) }">
                      <template v-if="isJson(scope.row[column.name])">
                        <el-popover
                          placement="right"
                          :width="400"
                          trigger="click"
                        >
                          <template #reference>
                            <el-button size="small" type="info" plain>查看JSON</el-button>
                          </template>
                          <div class="json-viewer">
                            <pre>{{ formatJson(scope.row[column.name]) }}</pre>
                          </div>
                        </el-popover>
                      </template>
                      <template v-else-if="isDate(scope.row[column.name])">
                        {{ formatDate(scope.row[column.name]) }}
                      </template>
                      <template v-else-if="isLongText(scope.row[column.name])">
                        <el-popover
                          placement="right"
                          :width="400"
                          trigger="click"
                        >
                          <template #reference>
                            <span class="text-preview">{{ getTextPreview(scope.row[column.name]) }}</span>
                          </template>
                          <div class="text-content">{{ scope.row[column.name] }}</div>
                        </el-popover>
                      </template>
                      <template v-else>
                        {{ scope.row[column.name] }}
                      </template>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            
            <div class="table-footer">
              <p>总记录数: {{ tablesData[tableName]?.data.length }}</p>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../utils/api'
import { useRouter } from 'vue-router'
import { HomeFilled } from '@element-plus/icons-vue'

// 路由
const router = useRouter()

// 状态变量
const loading = ref(true)
const error = ref('')
const tables = ref<string[]>([])
const tablesData = ref<Record<string, any>>({})
const activeTable = ref('')
const searchInputs = ref<Record<string, string>>({})
const filteredData = ref<Record<string, any[]>>({})

// 获取数据库信息
const fetchDatabaseInfo = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // 使用完整URL直接访问后端API
    const response = await api.get('http://localhost:3000/api/config/database/tables')
    
    if (response.data.success) {
      tables.value = response.data.tables
      tablesData.value = response.data.tablesData
      
      if (tables.value.length > 0) {
        activeTable.value = tables.value[0]
      }
      
      // 初始化搜索输入和过滤数据
      tables.value.forEach(tableName => {
        searchInputs.value[tableName] = ''
        filteredData.value[tableName] = tablesData.value[tableName]?.data || []
      })
    } else {
      throw new Error(response.data.message || '获取数据库信息失败')
    }
  } catch (err) {
    console.error('获取数据库信息失败:', err)
    error.value = err instanceof Error ? err.message : '获取数据库信息失败'
    ElMessage.error('获取数据库信息失败')
  } finally {
    loading.value = false
  }
}

// 搜索处理
const handleSearch = (tableName: string) => {
  const searchTerm = searchInputs.value[tableName]?.toLowerCase() || ''
  const tableData = tablesData.value[tableName]?.data || []
  
  if (!searchTerm) {
    filteredData.value[tableName] = tableData
    return
  }
  
  filteredData.value[tableName] = tableData.filter(row => {
    return Object.values(row).some(value => {
      if (value === null || value === undefined) return false
      return String(value).toLowerCase().includes(searchTerm)
    })
  })
}

// 导出表数据为CSV
const exportTable = (tableName: string) => {
  const tableData = tablesData.value[tableName]?.data || []
  const columns = tablesData.value[tableName]?.columns || []
  
  if (tableData.length === 0 || columns.length === 0) {
    ElMessage.warning('没有数据可导出')
    return
  }
  
  const headerRow = columns.map(col => `"${col.name}"`).join(',')
  
  const dataRows = tableData.map(row => {
    return columns.map(col => {
      const value = row[col.name]
      // 处理null、undefined和特殊字符
      if (value === null || value === undefined) return '""'
      if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`
      return `"${value}"`
    }).join(',')
  }).join('\n')
  
  const csvContent = `${headerRow}\n${dataRows}`
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${tableName}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  ElMessage.success(`${tableName} 表导出成功`)
}

// 工具函数
const isJson = (value: any): boolean => {
  if (typeof value !== 'string') return false
  try {
    const result = JSON.parse(value)
    return typeof result === 'object' && result !== null
  } catch {
    return false
  }
}

const formatJson = (jsonString: string): string => {
  try {
    return JSON.stringify(JSON.parse(jsonString), null, 2)
  } catch {
    return jsonString
  }
}

const isDate = (value: any): boolean => {
  if (typeof value !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(value)
}

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN')
  } catch {
    return dateString
  }
}

const isLongText = (value: any): boolean => {
  if (typeof value !== 'string') return false
  return value.length > 50
}

const getTextPreview = (text: string): string => {
  return text.substring(0, 50) + (text.length > 50 ? '...' : '')
}

const getColumnWidth = (column: any): number => {
  const name = column.name
  if (name.includes('id') || name.includes('_id')) return 100
  if (name.includes('created_at') || name.includes('updated_at') || name.includes('date')) return 180
  if (name.includes('status') || name.includes('type')) return 120
  if (name.includes('content') || name.includes('feedback') || name.includes('text')) return 200
  return 150
}

// 导航到首页
const goToHome = () => {
  ElMessage.success('正在返回首页...')
  router.push('/home')
}

// 生命周期
onMounted(() => {
  fetchDatabaseInfo()
})

// 监听活动表切换
watch(activeTable, (newTable) => {
  if (newTable && !filteredData.value[newTable]) {
    filteredData.value[newTable] = tablesData.value[newTable]?.data || []
  }
})
</script>

<style scoped>
.database-view {
  padding: 20px;
  max-width: 1600px;
  margin: 0 auto;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 2px solid #409EFF;
  padding-bottom: 10px;
}

.title {
  font-size: 24px;
  margin: 0;
  color: #303133;
}

.home-button {
  transition: all 0.3s;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 5px;
}

.home-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.loading-container {
  margin-top: 40px;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 40px;
}

.retry-button {
  margin-top: 20px;
}

.database-content {
  margin-top: 20px;
}

.table-tabs {
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.table-info {
  padding: 10px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.table-header h3 {
  margin: 0;
  color: #409EFF;
}

.table-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.search-input {
  width: 240px;
}

.table-container {
  margin-bottom: 20px;
  overflow: hidden;
  border-radius: 4px;
}

.table-footer {
  display: flex;
  justify-content: flex-end;
  color: #606266;
  font-size: 14px;
}

.cell-content {
  display: flex;
  align-items: center;
}

.text-preview {
  cursor: pointer;
  color: #409EFF;
}

.text-content {
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.json-content {
  min-width: 80px;
}

.json-viewer {
  max-height: 500px;
  overflow-y: auto;
}

.json-viewer pre {
  margin: 0;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}
</style> 