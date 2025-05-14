<template>
  <div class="logs-container">
    <header class="logs-header">
      <h1>系统请求日志</h1>
      <div class="header-actions">
        <el-button 
          type="primary" 
          @click="$router.push('/home')"
          class="back-btn"
        >
          <el-icon><House/></el-icon>返回首页
        </el-button>
      </div>
    </header>

    <!-- 筛选区域 -->
    <div class="filter-container">
      <el-form :model="queryParams" label-position="left" class="filter-form" :inline="true">
        <el-form-item label="服务类型">
          <el-select 
            v-model="queryParams.serviceType" 
            placeholder="服务类型" 
            clearable
            @change="fetchLogs"
            class="filter-select"
          >
            <el-option 
              v-for="item in serviceTypes" 
              :key="item" 
              :label="item" 
              :value="item" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="模型">
          <el-select 
            v-model="queryParams.modelName" 
            placeholder="模型" 
            clearable
            @change="fetchLogs"
            class="filter-select"
          >
            <el-option 
              v-for="item in modelNames" 
              :key="item" 
              :label="item" 
              :value="item" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="请求类型">
          <el-select 
            v-model="queryParams.requestType" 
            placeholder="请求类型" 
            clearable
            @change="fetchLogs"
            class="filter-select"
          >
            <el-option label="批改反馈" value="feedback" />
            <el-option label="段落批注" value="annotation" />
            <el-option label="生成范文" value="example_essay" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select 
            v-model="queryParams.status" 
            placeholder="状态" 
            clearable
            @change="fetchLogs"
            class="filter-select"
          >
            <el-option label="成功" value="success" />
            <el-option label="失败" value="error" />
          </el-select>
        </el-form-item>
        <el-form-item label="项目状态">
          <el-select 
            v-model="queryParams.isProjectDeleted" 
            placeholder="项目状态" 
            clearable
            @change="fetchLogs"
            class="filter-select"
          >
            <el-option label="未删除" :value="false" />
            <el-option label="已删除" :value="true" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            @change="handleDateChange"
            style="width: 240px"
          />
        </el-form-item>
      </el-form>
    </div>

    <!-- 表格区域 -->
    <el-card class="table-card" shadow="hover">
      <template #header>
        <div class="table-header">
          <h3><el-icon><List /></el-icon> 日志列表</h3>
          <span v-if="logs.length > 0" class="table-count">共 {{ total }} 条记录</span>
        </div>
      </template>
      <el-table
        v-loading="loading"
        :data="logs"
        style="width: 100%"
        border
        stripe
        :row-class-name="tableRowClassName"
        highlight-current-row
        :header-cell-style="{ background: '#f5f5f7', color: '#333', fontWeight: '500' }"
      >
        <el-table-column prop="created_at" label="时间" min-width="150" sortable>
          <template #default="scope">
            <div class="table-cell-content">
              <el-icon><Calendar /></el-icon>
              <span>{{ formatDateTime(scope.row?.created_at) }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="service_type" label="服务类型" min-width="120">
          <template #default="scope">
            <el-tag size="small" effect="plain" type="info">
              {{ scope.row?.service_type || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="model_name" label="模型" min-width="160">
          <template #default="scope">
            <el-tag size="small" effect="plain" type="primary">
              {{ scope.row?.model_name || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="request_type" label="请求类型" min-width="120">
          <template #default="scope">
            <el-tag size="small" effect="plain" :type="getRequestTypeTagType(scope.row?.request_type)">
              {{ getRequestTypeLabel(scope.row?.request_type) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="paragraph_info" label="段落信息" min-width="80">
          <template #default="scope">
            <el-tooltip 
              v-if="scope.row?.paragraph_info" 
              :content="scope.row.paragraph_info" 
              placement="top" 
              :show-after="500"
            >
              <div class="ellipsis-text">{{ scope.row.paragraph_info }}</div>
            </el-tooltip>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="total_tokens" label="Token" min-width="100">
          <template #default="scope">
            <el-tooltip v-if="getTokenInfo(scope.row).promptTokens > 0" 
              :content="`提示词: ${getTokenInfo(scope.row).promptTokens}, 补全: ${getTokenInfo(scope.row).completionTokens}`" 
              placement="top"
            >
              <div class="table-cell-content">
                <el-icon><Coin /></el-icon>
                <span>{{ getTokenInfo(scope.row).totalTokens }}</span>
              </div>
            </el-tooltip>
            <span v-else>{{ getTokenInfo(scope.row).totalTokens }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="duration" label="耗时(s)" min-width="100">
          <template #default="scope">
            <div class="table-cell-content">
              <el-icon><Timer /></el-icon>
              <span>{{ scope.row?.duration / 1000 || 0 }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" min-width="100">
          <template #default="scope">
            <el-tag 
              :type="scope.row?.status === 'success' ? 'success' : 'danger'"
              effect="light"
              size="small"
              round
            >
              {{ scope.row?.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" fixed="right" min-width="80" width="80">
          <template #default="scope">
            <el-button link type="primary" @click="viewDetails(scope.row)">
              <el-icon><View /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空数据展示 -->
      <el-empty v-if="logs.length === 0 && !loading" description="暂无日志数据"></el-empty>

      <!-- 分页器 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[5, 10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          background
          :pager-count="5"
        />
      </div>
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="日志详情"
      width="90%"
      top="5vh"
      :destroy-on-close="true"
      class="log-detail-dialog"
    >
      <template #header>
        <div class="dialog-header">
          <h3 class="dialog-title">
            <el-icon><Document /></el-icon>
            请求日志详情
          </h3>
          <div class="dialog-subtitle" v-if="selectedLog">
            <el-tag 
              size="small" 
              :type="selectedLog.status === 'success' ? 'success' : 'danger'"
              effect="light"
              round
            >
              {{ selectedLog.status === 'success' ? '成功' : '失败' }}
            </el-tag>
            <span class="dialog-id">ID: {{ selectedLog.request_id || '-' }}</span>
          </div>
        </div>
      </template>
      
      <div v-if="selectedLog" class="log-detail">
        <!-- 左侧区域 -->
        <div class="log-detail-left">
          <!-- 基本信息卡片 -->
          <el-card class="detail-card" shadow="hover">
            <template #header>
              <div class="detail-card-header">
                <h3><el-icon><InfoFilled /></el-icon> 基本信息</h3>
              </div>
            </template>
            
            <div class="detail-info">
              <div class="info-row">
                <p class="info-label"><el-icon><Calendar /></el-icon> 请求时间</p>
                <p class="info-value">{{ formatDateTime(selectedLog.created_at) }}</p>
              </div>
              
              <div class="info-row">
                <p class="info-label"><el-icon><Service /></el-icon> 服务类型</p>
                <p class="info-value">
                  <el-tag size="small" effect="plain" type="info">
                    {{ selectedLog.service_type || '-' }}
                  </el-tag>
                </p>
              </div>
              
              <div class="info-row">
                <p class="info-label"><el-icon><Cpu /></el-icon> 模型名称</p>
                <p class="info-value">
                  <el-tag size="small" effect="plain" type="primary">
                    {{ selectedLog.model_name || '-' }}
                  </el-tag>
                </p>
              </div>
              
              <div class="info-row">
                <p class="info-label"><el-icon><Paperclip /></el-icon> 请求类型</p>
                <p class="info-value">
                  <el-tag size="small" effect="plain" :type="getRequestTypeTagType(selectedLog.request_type)">
                    {{ getRequestTypeLabel(selectedLog.request_type) }}
                  </el-tag>
                </p>
              </div>
              
              <div class="info-row">
                <p class="info-label"><el-icon><DocumentCopy /></el-icon> 段落信息</p>
                <p class="info-value ellipsis-text">{{ selectedLog.paragraph_info || '-' }}</p>
              </div>
              
              <div class="info-row">
                <p class="info-label"><el-icon><Coin /></el-icon> Token 使用</p>
                <p class="info-value token-info">
                  <span class="token-item">
                    <span class="token-label">提示词:</span>
                    <span class="token-value">{{ getTokenInfo(selectedLog).promptTokens }}</span>
                  </span>
                  <span class="token-item">
                    <span class="token-label">补全:</span>
                    <span class="token-value">{{ getTokenInfo(selectedLog).completionTokens }}</span>
                  </span>
                  <span class="token-item">
                    <span class="token-label">总计:</span>
                    <span class="token-value highlight">{{ getTokenInfo(selectedLog).totalTokens }}</span>
                  </span>
                </p>
              </div>
              
              <div class="info-row">
                <p class="info-label"><el-icon><Timer /></el-icon> 请求耗时</p>
                <p class="info-value">{{ selectedLog.duration || 0 }}ms</p>
              </div>
              
              <div class="info-row error-info" v-if="selectedLog.error_message">
                <p class="info-label"><el-icon><WarningFilled /></el-icon> 错误信息</p>
                <p class="info-value error-message">
                  {{ selectedLog.error_message }}
                </p>
              </div>
            </div>
          </el-card>

          <!-- 提示词内容卡片 -->
          <el-card class="prompt-card" shadow="hover">
            <template #header>
              <div class="detail-card-header">
                <h3><el-icon><ChatLineRound /></el-icon> 提示词内容</h3>
                <el-tooltip content="复制提示词" placement="top">
                  <el-button 
                    type="primary" 
                    size="small" 
                    plain
                    @click="copyToClipboard(selectedLog.prompt_content)"
                    class="copy-btn"
                    circle
                  >
                    <el-icon><CopyDocument /></el-icon>
                  </el-button>
                </el-tooltip>
              </div>
            </template>
            <pre class="code-block prompt-block">{{ formatContent(selectedLog.prompt_content) || '无内容' }}</pre>
          </el-card>
        </div>

        <!-- 右侧区域 -->
        <div class="log-detail-right">
          <el-card class="content-card" shadow="hover">
            <el-tabs type="card" class="content-tabs">
              <el-tab-pane>
                <template #label>
                  <span class="tab-label">
                    <el-icon><ChatDotRound /></el-icon> 响应内容
                  </span>
                </template>
                <div class="code-wrapper">
                  <pre class="code-block response-block">{{ formatContent(selectedLog.response_content) || '无内容' }}</pre>
                  <div class="code-actions">
                    <el-tooltip content="复制响应内容" placement="top">
                      <el-button 
                        type="primary" 
                        size="small" 
                        plain
                        @click="copyToClipboard(selectedLog.response_content)"
                        class="copy-btn"
                        circle
                      >
                        <el-icon><CopyDocument /></el-icon>
                      </el-button>
                    </el-tooltip>
                  </div>
                </div>
              </el-tab-pane>
              
              <el-tab-pane>
                <template #label>
                  <span class="tab-label">
                    <el-icon><Connection /></el-icon> 原始响应
                  </span>
                </template>
                <div class="code-wrapper">
                  <pre class="code-block json-content" v-html="formatJSONWithSyntaxHighlight(selectedLog.raw_response)"></pre>
                  <div class="code-actions">
                    <el-tooltip content="复制原始响应" placement="top">
                      <el-button 
                        type="primary" 
                        size="small" 
                        plain
                        @click="copyToClipboard(selectedLog.raw_response)"
                        class="copy-btn"
                        circle
                      >
                        <el-icon><CopyDocument /></el-icon>
                      </el-button>
                    </el-tooltip>
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </el-card>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false" plain>关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { getLogs, getServiceTypes, getModelNames, type LogItem, type LogsQueryParams } from '../api/logs';
import { ElMessage } from 'element-plus';
import { 
  List, Calendar, 
  Coin, Timer, View, Document, InfoFilled, Service, Cpu, 
  Paperclip, DocumentCopy, WarningFilled, ChatLineRound, 
  ChatDotRound, Connection, CopyDocument, House
} from '@element-plus/icons-vue';

// 状态
const logs = ref<LogItem[]>([]);
const total = ref(0);
const loading = ref(false);
const currentPage = ref(1);
// 默认每页展示多少
const pageSize = ref(10);
const serviceTypes = ref<string[]>([]);
const modelNames = ref<string[]>([]);
const dateRange = ref<[string, string] | null>(null);
const dialogVisible = ref(false);
const selectedLog = ref<LogItem | null>(null);

// 查询参数
const queryParams = reactive<LogsQueryParams>({
  limit: pageSize.value,
  offset: 0
});

// 获取请求类型标签文本
const getRequestTypeLabel = (requestType: string): string => {
  if (requestType === 'feedback') return '批改反馈';
  if (requestType === 'annotation') return '段落批注';
  if (requestType === 'example_essay') return '生成范文';
  if (requestType === 'chat') return '随心问';
  return requestType || '-';
};

// 获取请求类型标签样式
const getRequestTypeTagType = (requestType: string): string => {
  if (requestType === 'feedback') return 'success';
  if (requestType === 'annotation') return 'warning';
  if (requestType === 'example_essay') return 'info';
  if (requestType === 'chat') return 'primary';
  return 'info';
};

// 获取日志数据
async function fetchLogs() {
  try {
    loading.value = true;
    
    // 计算分页偏移量
    queryParams.offset = (currentPage.value - 1) * pageSize.value;
    queryParams.limit = pageSize.value;
    
    const response = await getLogs(queryParams);
    console.log('API返回数据:', response);
    
    // 兼容两种可能的返回格式
    if (response.logs && Array.isArray(response.logs)) {
      logs.value = response.logs;
      total.value = response.total || 0;
    } else {
      logs.value = [];
      total.value = 0;
      console.error('未能识别API返回格式:', response);
    }
  } catch (error) {
    console.error('获取日志失败:', error);
    ElMessage.error('获取日志数据失败');
    logs.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

// 获取筛选选项数据
async function fetchFilterOptions() {
  try {
    const [types, names] = await Promise.all([
      getServiceTypes(),
      getModelNames()
    ]);
    serviceTypes.value = types;
    modelNames.value = names;
  } catch (error) {
    console.error('获取筛选选项失败:', error);
  }
}

// 重置筛选条件

// 日期范围变化处理
function handleDateChange(val: [string, string] | null) {
  if (val) {
    queryParams.startDate = val[0];
    queryParams.endDate = val[1];
  } else {
    queryParams.startDate = undefined;
    queryParams.endDate = undefined;
  }
}

// 分页处理
function handleSizeChange() {
  // 使用v-model后，页面大小变化会自动反映在pageSize.value中
  // 只需重新获取数据
  fetchLogs();
}

function handleCurrentChange() {
  // 使用v-model后，页码变化会自动反映在currentPage.value中
  // 只需重新获取数据
  fetchLogs();
}

// 格式化日期时间
function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// 查看详情
function viewDetails(log: LogItem) {
  selectedLog.value = log;
  dialogVisible.value = true;
}

// 设置表格行样式
function tableRowClassName({ row }: { row: LogItem }) {
  if (row.status === 'error') {
    return 'error-row';
  }
  return '';
}

// 格式化提示词和响应内容，使其更易读
function formatContent(content: string | undefined): string {
  if (!content) return '';
  
  // 保留换行符和空格
  return content
    .replace(/\\n/g, '\n')  // 替换 \n 字符串为实际的换行符
    .replace(/\\t/g, '    ')  // 替换 \t 为四个空格
    .replace(/\\"/g, '"')  // 替换 \" 为实际的引号
    .replace(/\\'/g, "'");  // 替换 \' 为实际的单引号
}

// 复制内容到剪贴板
function copyToClipboard(text: string | undefined) {
  if (!text) {
    ElMessage.warning('无内容可复制');
    return;
  }
  
  // 对内容进行格式化后再复制
  const formattedText = formatContent(text);
  
  navigator.clipboard.writeText(formattedText)
    .then(() => {
      ElMessage.success('复制成功');
    })
    .catch(err => {
      console.error('复制失败:', err);
      ElMessage.error('复制失败');
    });
}

// 格式化JSON

// 格式化JSON并添加语法高亮
function formatJSONWithSyntaxHighlight(jsonStr: string | undefined): string {
  if (!jsonStr) return '';
  
  try {
    const json = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    return syntaxHighlight(JSON.stringify(json, null, 2));
  } catch (e) {
    console.error('JSON格式化失败:', e);
    return jsonStr?.toString() || '';
  }
}

// JSON语法高亮处理
function syntaxHighlight(json: string): string {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, 
    function (match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    }
  );
}

// 获取Token信息
function getTokenInfo(log: LogItem) {
  if (log.raw_response) {
    try {
      const response = JSON.parse(log.raw_response);
      if (response.usage) {
        return {
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          totalTokens: response.usage.total_tokens || 0
        };
      }
    } catch (e) {
      console.error('解析 raw_response 失败:', e);
    }
  }
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: log.token_usage || 0
  };
}

// 生命周期
onMounted(() => {
  fetchLogs();
  fetchFilterOptions();
});
</script>

<style scoped>
.logs-container {
  padding: 20px;
  width: 100%;
  height: 100%;
  margin: 0;
  background-color: #f5f5f7;
  min-height: 100vh;
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  box-sizing: border-box;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.logs-container::-webkit-scrollbar {
  display: none;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  position: relative;
}

.logs-header h1 {
  font-size: 1.6rem;
  font-weight: 500;
  color: #1d1d1f;
  margin: 0;
  letter-spacing: -0.02em;
}

.back-btn {
  margin-left: auto;
  border-radius: 8px;
  padding: 8px 16px;
  font-weight: 500;
  transition: all 0.2s ease;
  background-color: #0071e3;
  border-color: #0071e3;
}

.back-btn:hover {
  background-color: #0077ed;
  border-color: #0077ed;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.filter-container {
  background-color: #ffffff;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
  overflow-x: auto;
  white-space: nowrap;
  width: 100%;
}

.filter-container:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.filter-form {
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: nowrap;
  gap: 16px;
}

:deep(.el-form--inline .el-form-item) {
  margin-right: 0;
  margin-bottom: 0;
  flex: 1;
  min-width: 150px;
  max-width: 200px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #1d1d1f;
  font-size: 13px;
}

.filter-select {
  width: 100%;
}

:deep(.el-date-editor) {
  width: 100%;
  min-width: 200px;
  max-width: 240px;
}

.table-card {
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  margin-bottom: 20px;
  transition: all 0.2s ease;
  background-color: #ffffff;
  overflow: hidden;
  border: none;
  width: 100%;
  height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
  position: relative;
}

:deep(.el-card__body) {
  padding: 0;
  position: relative;
  overflow: hidden;
  height: 100%;
}

:deep(.el-table) {
  border-radius: 0;
  overflow: visible;
  --el-table-border-color: #f1f1f1;
  --el-table-border: 1px solid #f1f1f1;
  --el-table-header-bg-color: #f5f5f7;
  --el-table-row-hover-bg-color: #f9f9fb;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.el-table__body-wrapper) {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 60px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  position: relative;
  z-index: 0;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar) {
  display: none;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
}

.table-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #1d1d1f;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.table-count {
  font-size: 14px;
  color: #86868b;
}

.table-cell-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ellipsis-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

:deep(.el-table th) {
  font-weight: 500;
  color: #1d1d1f;
  padding: 12px;
}

:deep(.el-table td) {
  padding: 12px;
  color: #1d1d1f;
}

:deep(.el-table__row) {
  transition: all 0.2s ease;
}

:deep(.el-table__row:hover) {
  background-color: #f5f5f7;
}

:deep(.error-row) {
  background-color: rgba(255, 59, 48, 0.05);
}

:deep(.el-select),
:deep(.el-date-editor) {
  width: 100%;
}

:deep(.el-button) {
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
}

:deep(.el-button:hover) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.pagination-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  margin-top: 0;
  display: flex;
  justify-content: flex-end;
  padding: 16px;
  background-color: #ffffff;
  border-top: 1px solid #f1f1f1;
  z-index: 1;
  box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.05);
}

:deep(.el-pagination) {
  padding: 0;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-pagination .el-select) {
  width: 120px;
}

:deep(.el-pagination .el-pagination__sizes) {
  margin-right: 16px;
}

:deep(.el-pagination .el-pager li) {
  min-width: 32px;
  height: 32px;
  line-height: 32px;
  border-radius: 4px;
  margin: 0 4px;
}

:deep(.el-pagination .el-pager li.active) {
  background-color: #0071e3;
  color: #ffffff;
}

:deep(.el-pagination .btn-prev),
:deep(.el-pagination .btn-next) {
  min-width: 32px;
  height: 32px;
  line-height: 32px;
  border-radius: 4px;
  margin: 0 4px;
}

:deep(.el-dialog) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  background-color: #f5f5f7;
}

.dialog-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: #1d1d1f;
  letter-spacing: -0.02em;
}

.dialog-subtitle {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dialog-id {
  font-size: 14px;
  color: #86868b;
}

:deep(.el-dialog__header) {
  padding: 16px 20px;
  background-color: #f5f5f7;
  margin: 0;
  border-bottom: 1px solid #e6e6e6;
}

:deep(.el-dialog__title) {
  font-weight: 500;
  color: #1d1d1f;
}

:deep(.el-dialog__body) {
  padding: 20px;
  overflow: auto;
  background-color: #f5f5f7;
  max-height: 80vh;
}

:deep(.el-dialog__close) {
  font-size: 20px;
  font-weight: 500;
  color: #86868b;
}

:deep(.el-tag) {
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
  white-space: normal;
  word-break: break-all;
  line-height: 1.4;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  height: auto;
  max-width: 100%;
}

:deep(.el-tag__content) {
  white-space: normal;
  word-break: break-all;
  line-height: 1.4;
  display: inline-block;
  width: 100%;
}

.log-detail {
  display: flex;
  gap: 20px;
  height: 100%;
}

.log-detail-left {
  flex: 0 0 350px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.log-detail-right {
  flex: 1;
  min-width: 0;
}

.detail-card, .content-card, .prompt-card {
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  border: none;
  transition: all 0.2s ease;
  background-color: #ffffff;
  overflow: hidden;
  height: auto;
  margin: 0;
}

.prompt-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.detail-card:hover, .content-card:hover, .prompt-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.detail-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f1f1f1;
  background-color: #ffffff;
}

.detail-card-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #1d1d1f;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.detail-info {
  display: flex;
  flex-direction: column;
  padding: 0;
  max-height: 280px;
  overflow-y: auto;
}

.info-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #f1f1f1;
  padding: 10px 16px;
  transition: all 0.2s ease;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row:hover {
  background-color: #f9f9fb;
}

.error-info {
  background-color: rgba(255, 59, 48, 0.05);
  border-radius: 0;
  padding: 10px 16px;
  margin-top: 0;
}

.info-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #86868b;
  font-weight: 500;
  font-size: 13px;
  margin: 0;
  width: 100px;
  flex-shrink: 0;
}

.info-value {
  color: #1d1d1f;
  font-size: 13px;
  word-break: break-all;
  margin: 0;
  flex: 1;
  line-height: 1.5;
  display: flex;
  align-items: center;
}

.token-info {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.token-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.token-label {
  color: #86868b;
  font-size: 12px;
  display: flex;
  align-items: center;
}

.token-value {
  font-weight: 500;
  display: flex;
  align-items: center;
}

.token-value.highlight {
  color: #0071e3;
  font-weight: 600;
}

.error-message {
  color: #ff3b30;
}

.content-tabs {
  margin-top: 0;
  height: 100%;
}

:deep(.el-tabs) {
  background-color: #ffffff;
  height: 100%;
}

:deep(.el-tabs__content) {
  height: calc(100% - 40px);
  overflow: hidden;
}

:deep(.el-tab-pane) {
  height: 100%;
}

:deep(.el-tabs__header) {
  margin: 0;
  border-bottom: 1px solid #f1f1f1;
  background-color: #f9f9fb;
}

:deep(.el-tabs__item) {
  font-weight: 500;
  padding: 12px 20px;
  color: #1d1d1f;
  height: auto;
}

.code-block {
  background-color: #ffffff;
  padding: 16px;
  border-radius: 0;
  white-space: pre-wrap;
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow: auto;
  margin: 0;
  border: none;
  border-top: 1px solid #f1f1f1;
  transition: all 0.2s ease;
  color: #1d1d1f;
  tab-size: 2;
  -moz-tab-size: 2;
  text-wrap: pretty;
  overflow-wrap: break-word;
  max-height: 100%;
  height: auto;
  box-sizing: border-box;
}

.prompt-block {
  flex: 1;
  max-height: calc(100vh - 400px);
  overflow-y: auto;
  background-color: #f9f9fb;
  border-radius: 8px;
  box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.05);
  scrollbar-width: thin;
  scrollbar-color: #d1d1d6 transparent;
}

.prompt-block::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.prompt-block::-webkit-scrollbar-thumb {
  background-color: #d1d1d6;
  border-radius: 3px;
}

.prompt-block::-webkit-scrollbar-track {
  background-color: transparent;
}

.response-block {
  height: calc(100% - 24px);
  min-height: 500px;
  background-color: #f9f9fb;
  border-radius: 8px;
  box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.05);
  scrollbar-width: thin;
  scrollbar-color: #d1d1d6 transparent;
}

.response-block::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.response-block::-webkit-scrollbar-thumb {
  background-color: #d1d1d6;
  border-radius: 3px;
}

.response-block::-webkit-scrollbar-track {
  background-color: transparent;
}

.json-content {
  background-color: #f9f9fb;
  border-radius: 8px;
  tab-size: 2;
  -moz-tab-size: 2;
  box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.05);
  height: calc(100% - 24px);
  min-height: 500px;
}

.code-block:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.code-actions {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 1;
}

.copy-btn {
  opacity: 0.7;
  transition: all 0.2s ease;
}

.copy-btn:hover {
  opacity: 1;
  transform: translateY(-1px);
}

/* JSON 语法高亮样式 */
:deep(.json-string) {
  color: #c41a16; /* 红色 */
}

:deep(.json-key) {
  color: #0b6fcc; /* 蓝色 */
}

:deep(.json-number) {
  color: #1c00cf; /* 紫色 */
}

:deep(.json-boolean) {
  color: #c41a16; /* 红色 */
}

:deep(.json-null) {
  color: #5e5e5e; /* 灰色 */
}

.dialog-footer {
  text-align: right;
  padding: 12px 0 0;
}

@media screen and (max-width: 1024px) {
  .log-detail {
    flex-direction: column;
  }

  .log-detail-left {
    flex: none;
    width: 100%;
  }

  .log-detail-right {
    width: 100%;
  }

  .prompt-block {
    height: 200px;
  }
}

@media screen and (max-width: 768px) {
  .logs-container {
    padding: 12px;
  }
  
  .filter-container {
    padding: 12px;
    overflow-x: auto;
  }
  
  .token-info {
    flex-direction: column;
    gap: 6px;
  }
}

:deep(.el-tabs--card > .el-tabs__header .el-tabs__item.is-active) {
  border-bottom-color: #ffffff;
  color: #0071e3;
}

:deep(.el-tabs--card > .el-tabs__header .el-tabs__nav) {
  border: none;
}

:deep(.el-tabs--card > .el-tabs__header .el-tabs__item) {
  border: none;
  border-bottom: 2px solid transparent;
}

:deep(.el-tabs--card > .el-tabs__header .el-tabs__item.is-active) {
  border-bottom: 2px solid #0071e3;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 5px;
}

.code-wrapper {
  position: relative;
  height: 100%;
}

.response-block {
  height: calc(100% - 2px);
  min-height: 500px;
}

:deep(.el-table .cell) {
  padding: 8px 12px;
  line-height: 1.4;
}
</style> 