<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ArrowLeft, ArrowRight, Edit, Delete, Calendar, Star, InfoFilled, ArrowUp, Close, Check, Picture, QuestionFilled, ChatDotRound, RefreshRight } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import type { FeedbackData, ScoreDimension, Version, Annotation } from '@/types/feedback'
import { projectApi, chatApi } from '@/api/project'
import AnnotationHighlighter from './AnnotationHighlighter.vue'
import FeedbackProgress from './FeedbackProgress.vue'
// 导入confetti
import '../../plugin/canvas-confetti.js'
// 导入marked库用于Markdown渲染
import { marked } from 'marked'

// 设置marked选项
marked.setOptions({
  breaks: true, // 启用换行符转换为<br>
  gfm: true     // 启用GitHub风格的Markdown
})

// 定义组件属性
const props = defineProps<{
  visible: boolean
  feedbackData: FeedbackData
  versions: Version[]
  currentProject: {
    id: number | string
    title: string
    feedbacks?: {
      id: number
      versionNumber: number
      scoreTR: number
      scoreCC: number
      scoreLR: number
      scoreGRA: number
      feedbackTR: string
      feedbackCC: string
      feedbackLR: string
      feedbackGRA: string
      overallFeedback: string
      annotations?: string
    }[]
    chartImage?: {
      url: string
    }
  }
  // 添加任务类型，默认为Task1
  taskType?: 'Task1' | 'Task2'
}>()

// 定义事件
const emit = defineEmits(['update:visible', 'retry', 'delete', 'refresh'])

// 当前查看的版本索引
const currentVersionIndex = ref(0)

// 用于标记对话框打开状态
const isDialogFirstOpen = ref(true)

// 添加批改进度相关状态
const feedbackProgressVisible = ref(false)
const currentFeedbackId = ref<number>(0)

// 监听 visible 变化，处理打开和关闭逻辑
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    // 对话框打开时，总是显示最新版本
    if (props.versions?.length) {
      currentVersionIndex.value = props.versions.length - 1
    }
    isDialogFirstOpen.value = true
    
    // 当对话框打开时，预加载聊天记录以确保聊天功能正确初始化
    if (props.currentProject?.id && props.versions?.length) {
      const projectId = typeof props.currentProject.id === 'string' 
        ? parseInt(props.currentProject.id) 
        : props.currentProject.id;
      const versionNumber = props.versions[currentVersionIndex.value].versionNumber;
      
      // 预先加载聊天会话，但不显示AI面板
      chatApi.getChatHistory(projectId, versionNumber)
        .then(history => {
          if (history && history.length > 0) {
            // 有聊天记录，保存会话ID
            if (history[0].session_id) {
              currentSessionId.value = history[0].session_id;
            }
          } else {
            // 没有聊天记录，创建新会话（静默处理）
            chatApi.createChatSession(projectId, versionNumber)
              .then(sessionId => {
                currentSessionId.value = sessionId;
              })
              .catch(error => {
                console.error('预创建聊天会话失败:', error);
                // 生成临时会话ID作为备用
                currentSessionId.value = generateId();
              });
          }
        })
        .catch(error => {
          console.error('预加载聊天记录失败:', error);
        });
    }
    
    // 打开对话框时，输出项目和版本信息
    if (props.versions?.length && props.currentProject) {
      const version = props.versions[currentVersionIndex.value];
      const feedback = props.currentProject.feedbacks?.find(
        f => f.versionNumber === version.versionNumber
      );
      
      if (feedback) {
        // // console.log(
        //   `目前您打开的是项目${props.currentProject.id}，版本${version.versionNumber}，` +
        //   `从feedbacks表获取到的原始信息有${JSON.stringify(feedback)}，` +
        //   `从essay_versions表获取到的原始信息有${JSON.stringify(version)}，` +
        //   `从projects表获取到的原始信息有${JSON.stringify(props.currentProject)}`
        // );
        
        // 单独输出annotations信息
        // // console.log(`项目${props.currentProject.id}，版本${version.versionNumber}的annotations数据:`, 
        //   feedback.annotations || '无批注数据');
      }
    }
  } else {
    // 对话框关闭时，只重置重写模式，不再重置版本索引
    setTimeout(() => {
      // 只有在对话框完全关闭后才重置重写模式
      if (!props.visible) {
        isRewriteMode.value = false
      }
    }, 300)
  }
}, { immediate: true })

// 监听 versions 变化，在数据更新时确保显示最新版本
watch(() => props.versions, (newVersions) => {
  // 只要对话框是打开状态，并且versions数据更新了，就显示最新版本
  if (newVersions?.length && props.visible) {
    currentVersionIndex.value = newVersions.length - 1
  }
}, { immediate: true })

// 监听 currentVersionIndex 变化，在版本切换时输出信息和重新初始化聊天
watch(() => currentVersionIndex.value, (newIndex) => {
  if (props.visible && props.versions?.length && props.currentProject) {
    const version = props.versions[newIndex];
    const feedback = props.currentProject.feedbacks?.find(
      f => f.versionNumber === version.versionNumber
    );
    
    if (feedback) {
      // // console.log(
      //   `目前您打开的是项目${props.currentProject.id}，版本${version.versionNumber}，` +
      //   `从feedbacks表获取到的原始信息有${JSON.stringify(feedback)}，` +
      //   `从essay_versions表获取到的原始信息有${JSON.stringify(version)}，` +
      //   `从projects表获取到的原始信息有${JSON.stringify(props.currentProject)}`
      // );
      
      // 单独输出annotations信息
      // // console.log(`项目${props.currentProject.id}，版本${version.versionNumber}的annotations数据:`, 
      //   feedback.annotations || '无批注数据');
    }
    
    // 版本变更后，预初始化聊天会话
    const projectId = typeof props.currentProject.id === 'string' 
      ? parseInt(props.currentProject.id) 
      : props.currentProject.id;
    const versionNumber = version.versionNumber;
    
    // 预先加载新版本的聊天记录（不管AI面板是否打开）
    currentSessionId.value = ''; // 重置会话ID以触发重新加载
    
    // 只在面板打开时才实际加载内容
    if (showAIChatPanel.value) {
      loadChatHistory();
    } else {
      // 面板未打开时只静默预加载会话ID
      chatApi.getChatHistory(projectId, versionNumber)
        .then(history => {
          if (history && history.length > 0) {
            // 有聊天记录，保存会话ID
            if (history[0].session_id) {
              currentSessionId.value = history[0].session_id;
            }
          } else {
            // 没有聊天记录，创建新会话（静默处理）
            chatApi.createChatSession(projectId, versionNumber)
              .then(sessionId => {
                currentSessionId.value = sessionId;
              })
              .catch(error => {
                console.error('预创建聊天会话失败:', error);
              });
          }
        })
        .catch(error => {
          console.error('预加载聊天记录失败:', error);
        });
    }
  }
})

// 当前激活的维度
const activeDimension = ref<string | null>(null)

// 评分卡片是否展开
const isOverallFeedbackExpanded = ref(false)

// 添加重写模式状态
const isRewriteMode = ref(false)
const essayContent = ref<string>('')

// 计算实际任务类型 (默认为Task1)
const actualTaskType = computed(() => props.taskType || 'Task1')

// 字数限制
const contentLimit = computed(() => {
  // Task1限制500单词，Task2限制350单词
  return actualTaskType.value === 'Task1' ? 500 : 350
})

// 计算内容的单词数
const contentWordCount = computed(() => {
  return essayContent.value
    ? essayContent.value.trim().split(/\s+/).filter(word => word.length > 0).length
    : 0
})

// 计算剩余单词数
const contentRemaining = computed(() => contentLimit.value - contentWordCount.value)

// 评分维度说明
const scoreDimensions: ScoreDimension[] = [
  {
    key: 'TR',
    name: '任务响应',
    description: '文章是否准确回应了题目要求，论述是否充分完整'
  },
  {
    key: 'CC',
    name: '连贯衔接',
    description: '文章结构是否清晰，段落之间是否连贯，过渡是否自然'
  },
  {
    key: 'LR',
    name: '词汇资源',
    description: '词汇使用是否准确、丰富，是否有效传达意思'
  },
  {
    key: 'GRA',
    name: '语法准确',
    description: '句子结构是否多样，语法使用是否准确'
  }
]

// 计算当前版本
const currentVersion = computed(() => {
  return props.versions?.[currentVersionIndex.value]
})

// 计算当前版本的反馈数据
const currentFeedbackData = computed(() => {
  // 检查当前版本是否存在
  if (!currentVersion.value) {
    return props.feedbackData;
  }
  
  // 查找当前版本对应的反馈数据
  if (props.currentProject.feedbacks?.length) {
    const feedback = props.currentProject.feedbacks.find(
      f => f.versionNumber === currentVersion.value.versionNumber
    );
    
    if (feedback) {
      
      // 使用 as any 类型断言来避免 TypeScript 类型错误
      const rawFeedback = feedback as any;
      
      // 尝试通过计算获取overall_score - 应该与数据库中存储的值相同
      const calculatedScore = (rawFeedback.scoreTR + rawFeedback.scoreCC + rawFeedback.scoreLR + rawFeedback.scoreGRA) / 4;
      
      
      const result = {
        scores: {
          // 使用严格类型检查，确保数值0也被正确处理
          TR: typeof rawFeedback.scoreTR === 'number' ? rawFeedback.scoreTR : 0,
          CC: typeof rawFeedback.scoreCC === 'number' ? rawFeedback.scoreCC : 0,
          LR: typeof rawFeedback.scoreLR === 'number' ? rawFeedback.scoreLR : 0,
          GRA: typeof rawFeedback.scoreGRA === 'number' ? rawFeedback.scoreGRA : 0
        },
        // 保存原始分数字段，以便直接访问
        scoreTR: rawFeedback.scoreTR,
        scoreCC: rawFeedback.scoreCC,
        scoreLR: rawFeedback.scoreLR,
        scoreGRA: rawFeedback.scoreGRA,
        // 保存原始总分字段
        overallScore: rawFeedback.overallScore,
        // 使用与数据库相同的计算逻辑计算 overall_score
        overall_score: calculatedScore >= Math.floor(calculatedScore) + 0.75 
          ? Math.ceil(calculatedScore) 
          : calculatedScore >= Math.floor(calculatedScore) + 0.25 
            ? Math.floor(calculatedScore) + 0.5 
            : Math.floor(calculatedScore),
        feedback: {
          TR: rawFeedback.feedbackTR || '暂无评分',
          CC: rawFeedback.feedbackCC || '暂无评分',
          LR: rawFeedback.feedbackLR || '暂无评分',
          GRA: rawFeedback.feedbackGRA || '暂无评分',
          overall: rawFeedback.overallFeedback || '暂无总体评价'
        },
        // 添加批注字段
        annotations: rawFeedback.annotations || [],
        improvementSuggestions: rawFeedback.improvementSuggestions || [],
        targetScore: props.feedbackData.targetScore,
        previousScore: props.feedbackData.previousScore
      };
    
      return result;
    }
  }
  
  // 如果没有找到对应版本的反馈，返回默认反馈数据
  return props.feedbackData;
})

// 计算总分
const overallScore = computed(() => {
  
  const rawFeedback = currentFeedbackData.value as any;
  
  // 首先检查是否有 overall_score 字段
  if (typeof rawFeedback.overall_score === 'number' && rawFeedback.overall_score > 0) {
    return rawFeedback.overall_score.toFixed(1);
  }
  
  // 然后检查标准的 overallScore 字段
  if (typeof rawFeedback.overallScore === 'number' && rawFeedback.overallScore > 0) {
    return rawFeedback.overallScore.toFixed(1);
  }
  
  // 如果前两者都不存在，则计算平均分
  const scores = currentFeedbackData.value.scores;
  const average = ((scores.TR + scores.CC + scores.LR + scores.GRA) / 4).toFixed(1);
  return average;
})

// 计算进步分数
const improvementScore = computed(() => {
  // 确保前一个分数存在
  if (!currentFeedbackData.value.previousScore) return null;
  
  const improvement = Number(overallScore.value) - currentFeedbackData.value.previousScore;
  return improvement > 0 ? improvement.toFixed(1) : null;
})

// 随机选择一个正向反馈表情
const positiveEmojis = ['🎯', '✨', '🌟', '💫', '⭐️', '🎊', '🎉', '👏', '💪', '🔥']
const encouragementPhrases = ['继续努力', '加油加油', '再接再厉', '稳步提升', '坚持就是胜利', '不要放弃', '即将突破']
const selectedEmoji = positiveEmojis[Math.floor(Math.random() * positiveEmojis.length)]
const selectedPhrase = encouragementPhrases[Math.floor(Math.random() * encouragementPhrases.length)]

// 处理关闭对话框
const handleClose = () => {
  // 关闭对话框
  emit('update:visible', false)
  
  // 延迟0.5秒后重置展开状态，确保动画完成
  setTimeout(() => {
    isOverallFeedbackExpanded.value = false
  }, 300)
}

// 处理版本切换
const handleVersionChange = (direction: 'prev' | 'next') => {
  if (direction === 'prev' && currentVersionIndex.value > 0) {
    currentVersionIndex.value--
  } else if (direction === 'next' && currentVersionIndex.value < props.versions.length - 1) {
    currentVersionIndex.value++
  }
}

// 切换维度展示
const toggleDimension = (key: string) => {
  activeDimension.value = activeDimension.value === key ? null : key
}

// 切换评分卡片展开状态
const toggleOverallFeedback = () => {
  isOverallFeedbackExpanded.value = !isOverallFeedbackExpanded.value
}

// 处理删除项目
const handleDelete = async () => {
  try {
    await ElMessageBox.confirm('确定要删除这个项目吗？删除后将无法恢复。', '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    try {
      const projectId = typeof props.currentProject.id === 'string' ? parseInt(props.currentProject.id) : props.currentProject.id
      await projectApi.deleteProject(projectId)
      handleClose()
      emit('delete', projectId)
    } catch (error) {
      console.error('删除项目失败:', error)
      ElMessage.error('删除项目失败，请稍后重试')
    }
  } catch {
    // 用户取消删除
  }
}

// 处理重新尝试
const handleRetry = async () => {
  try {
    await ElMessageBox.confirm('确定要重新尝试这篇作文吗？', '确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    })
    
    // 保存当前查看的版本号
    const currentVersion = props.versions[currentVersionIndex.value]
    
    // 准备重写内容
    if (currentVersion?.content) {
      if (Array.isArray(currentVersion.content)) {
        essayContent.value = currentVersion.content.join('\n\n')
      } else if (typeof currentVersion.content === 'string') {
        essayContent.value = currentVersion.content
      }
    }
    
    // 切换到重写模式
    isRewriteMode.value = true
  } catch {
    // 用户取消重试
  }
}

// 处理重写取消
const handleRewriteCancel = async () => {
  try {
    await ElMessageBox.confirm('确定要取消重写吗？您所做的修改将不会保存。', '取消确认', {
      confirmButtonText: '确定',
      cancelButtonText: '继续编辑',
      type: 'warning'
    })
    
    // 切换回反馈模式
    isRewriteMode.value = false
  } catch {
    // 用户选择继续编辑
  }
}

// 处理重写提交
const handleRewriteSubmit = async () => {
  if (!props.currentProject.id) {
    ElMessage.error('无法获取项目信息，请重试')
    return
  }
  
  try {
    // 确保有内容
    if (!essayContent.value.trim()) {
      ElMessage.warning('作文内容不能为空')
      return
    }
    
    // 检查字数是否超过限制
    if (contentWordCount.value > contentLimit.value) {
      ElMessage.warning(`作文内容不能超过${contentLimit.value}个单词`)
      return
    }
    
    // 添加确认对话框
    try {
      await ElMessageBox.confirm('确定要提交这篇重写的作文吗？', '提交确认', {
        confirmButtonText: '确定提交',
        cancelButtonText: '取消',
        type: 'info'
      })
    } catch {
      // 用户取消提交
      return
    }
    
    // 处理paragraphs
    const paragraphs = essayContent.value
      .split('\n\n')
      .filter(p => p.trim().length > 0)
    
    // 计算字数
    const wordCount = essayContent.value.split(/\s+/).filter(w => w.trim().length > 0).length
    
    // 尝试提交新版本
    try {
      // 转换项目ID为数字
      const projectId = typeof props.currentProject.id === 'string' ? parseInt(props.currentProject.id) : props.currentProject.id
      
      // 使用projectApi创建新版本
      const newVersion = await projectApi.createVersion(projectId, {
        content: paragraphs.join('\n\n'),
        wordCount: wordCount
      })
      
      // console.log('【再次尝试】成功创建新版本:', newVersion)
      ElMessage.success('作文提交成功，正在启动批改...')
      
      // 获取新版本号
      const newVersionNumber = newVersion.versionNumber || props.versions.length + 1
      
      // 调用豆包批改服务
      try {
        // console.log(`【再次尝试】启动批改，项目ID: ${projectId}, 版本号: ${newVersionNumber}`)
        const response = await projectApi.generateActiveFeedback(projectId, newVersionNumber, {
          useStepByStepStrategy: true,
          targetScore: props.feedbackData.targetScore,
          generateExampleEssay: true // 确保每次都生成范文
        })
        
        // console.log(`【${getTaskTypeString()}】批改响应数据:`, response)
        
        if (response && response.feedbackId) {
          // 显示处理进度对话框
          // console.log(`【${getTaskTypeString()}】设置批改ID=${response.feedbackId}，准备显示进度对话框`)
          currentFeedbackId.value = response.feedbackId
          feedbackProgressVisible.value = true
          // console.log(`【${getTaskTypeString()}】进度对话框状态: feedbackProgressVisible=${feedbackProgressVisible.value}, currentFeedbackId=${currentFeedbackId.value}`)
          // console.log(`【再次尝试】批改已启动，反馈ID: ${response.feedbackId}`)
          
          // 延迟关闭对话框，确保进度对话框有时间显示
          // console.log(`【${getTaskTypeString()}】延迟500ms关闭主对话框`)
          setTimeout(() => {
            // console.log(`【${getTaskTypeString()}】关闭主对话框前，进度对话框状态: visible=${feedbackProgressVisible.value}`)
            emit('update:visible', false)
            // console.log(`【${getTaskTypeString()}】主对话框已关闭，进度对话框状态: visible=${feedbackProgressVisible.value}`)
          }, 500)
          
          // 通知父组件刷新数据
          emit('refresh')
        } else {
          console.error(`【${getTaskTypeString()}】response中缺少feedbackId:`, response)
          throw new Error('未能获取反馈ID')
        }
      } catch (aiError) {
        console.error('【再次尝试】批改启动失败:', aiError)
        ElMessage.warning('作文已提交成功，但批改启动失败，请稍后在项目列表中查看')
      }
    } catch (err) {
      console.error('无法创建新版本:', err)
      ElMessage.error('创建新版本失败，请稍后重试')
    }
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error('提交失败，请重试')
  }
}

// 计算当前版本的批注数据
const currentFeedbackAnnotations = computed(() => {
  // 从当前反馈数据中获取批注
  const annotations = currentFeedbackData.value?.annotations || [];
  
  // 如果annotations是字符串，尝试解析JSON
  if (typeof annotations === 'string') {
    try {
      const parsed = JSON.parse(annotations);
      return parsed;
    } catch (e) {
      console.error('批注数据解析失败:', e);
      return [];
    }
  }
  
  return annotations;
});

// 为每个段落过滤出对应的批注
const filterAnnotationsForParagraph = (paragraph: string, _paragraphIndex: number) => {
  if (!currentFeedbackAnnotations.value || currentFeedbackAnnotations.value.length === 0) {
    return [];
  }
  
  // console.log(`过滤段落的批注，段落内容:`, paragraph);
  
  // 使用批注ID去重Map
  const uniqueAnnotationsMap = new Map<string, Annotation>();
  
  // 跟踪重叠位置的批注，以便后续处理
  const overlapPositions: Record<string, string[]> = {};
  
  // 过滤出属于当前段落的批注 - 使用original_content进行匹配
  currentFeedbackAnnotations.value.forEach((annotation: Annotation, index: number) => {
    // 确保original_content有效
    if (!annotation.original_content || !annotation.original_content.trim()) {
      console.warn(`批注 ${index} 没有有效的original_content，跳过处理`);
      return;
    }
    
    const originalContent = annotation.original_content.trim();
    
    // 使用更严格的匹配，确保批注内容确实在此段落中
    const isIncluded = paragraph.includes(originalContent);
    // console.log(`检查批注(original_content=${originalContent})是否在段落中: ${isIncluded}`);
    
    if (isIncluded) {
      // 检查批注是否与现有批注位置重叠
      // 使用批注内容作为唯一键，避免重复添加相同内容的批注
      const uniqueKey = `${annotation.type}-${originalContent}`;
      
      // 记录每个批注的位置，用于检测重叠
      const startPos = paragraph.indexOf(originalContent);
      const endPos = startPos + originalContent.length;
      const positionKey = `${startPos}-${endPos}`;
      
      if (!overlapPositions[positionKey]) {
        overlapPositions[positionKey] = [];
      }
      overlapPositions[positionKey].push(uniqueKey);
      
      if (!uniqueAnnotationsMap.has(uniqueKey)) {
        // 添加唯一标识，方便后续处理
        uniqueAnnotationsMap.set(uniqueKey, { 
          ...annotation, 
          id: index,
          // 添加位置信息，方便AnnotationHighlighter组件使用
          position: { start: startPos, end: endPos }
        });
      }
    }
  });
  
  // 转换为数组
  const filteredAnnotations = Array.from(uniqueAnnotationsMap.values());
  
  // 记录重叠批注位置，便于调试
  Object.entries(overlapPositions).forEach(([_position, keys]) => {
    if (keys.length > 1) {
      // console.log(`有重叠批注:`, keys);
    }
  });
  
  return filteredAnnotations;
};

// 添加五彩纸屑效果函数
const confettiCooldown = ref(false);

const triggerConfetti = (event: MouseEvent) => {
  // 检查冷却时间
  if (confettiCooldown.value) {
    return;
  }

  // 设置冷却状态
  confettiCooldown.value = true;
  setTimeout(() => {
    confettiCooldown.value = false;
  }, 5000); // 5秒冷却期

  // 获取点击元素的位置
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  
  // 计算元素中心相对于窗口的位置
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // 计算相对于窗口的位置 (这是confetti库期望的值 - 相对于整个窗口的比例)
  const x = centerX / window.innerWidth;
  const y = centerY / window.innerHeight;

  // 使用固定的z-index确保烟花显示在对话框内部
  const canvasEl = document.createElement('canvas');
  canvasEl.style.position = 'fixed';
  canvasEl.style.pointerEvents = 'none';
  canvasEl.style.top = '0';
  canvasEl.style.left = '0';
  canvasEl.style.width = '100%';
  canvasEl.style.height = '100%';
  canvasEl.style.zIndex = '10000'; // 使用高z-index确保在对话框之上
  document.body.appendChild(canvasEl);

  // 随机颜色组合（使用更柔和的颜色）
  const colorSets = [
    ['#26ccff', '#a25afd', '#ff5e7e'],
    ['#88ff5a', '#fcff42', '#ffa62d'],
    ['#fd5e53', '#fd3a84', '#fa26a0'],
    ['#01c5c4', '#b8de6f', '#f1e189']
  ];
  
  // 随机选择一组颜色
  const colors = colorSets[Math.floor(Math.random() * colorSets.length)];
  
  // 微调效果参数，使其更微妙
  const particleCount = 20 + Math.floor(Math.random() * 15); // 减少粒子数量
  const spread = 30 + Math.floor(Math.random() * 20); // 适中的扩散范围
  const startVelocity = 15 + Math.floor(Math.random() * 10); // 较低的初始速度
  const ticks = 120 + Math.floor(Math.random() * 50); // 较短的持续时间
  
  // 创建自定义的confetti实例，使用我们的canvas
  const myConfetti = (window as any).confetti.create(canvasEl, {
    resize: true,
    useWorker: true
  });
  
  // 触发confetti
  myConfetti({
    particleCount: particleCount,
    spread: spread,
    origin: { x, y },
    colors: colors,
    startVelocity: startVelocity,
    gravity: 0.7,
    scalar: 0.6, // 更小的粒子
    ticks: ticks,
    disableForReducedMotion: true // 对动效敏感的用户禁用
  }).then(() => {
    // 完成后移除canvas
    document.body.removeChild(canvasEl);
  });
}

// 添加图片查看相关状态
const showImagePreview = ref(false)
const imageUrl = ref('')

// 处理图片点击
const handleImageClick = (url: string) => {
  imageUrl.value = url
  showImagePreview.value = true
}

// 关闭图片预览
const closeImagePreview = () => {
  showImagePreview.value = false
}

// 添加处理FeedbackProgress事件的方法
const handleFeedbackCompleted = (data: { feedbackId: number, projectId: number, versionNumber: number }) => {
  console.log('批改完成:', data)
  // 更新当前反馈ID
  currentFeedbackId.value = data.feedbackId
}

const handleFeedbackFailed = () => {
  console.log('批改失败')
  ElMessage.error('批改失败，请重试')
}

const handleOpenFeedbackDialog = (data: { projectId: number, versionNumber: number, feedbackId: number }) => {
  console.log('打开反馈对话框:', data)
  // 关闭进度对话框
  feedbackProgressVisible.value = false
  // 刷新数据
  emit('refresh')
  // 重新打开反馈对话框
  emit('update:visible', true)
}

// 控制台记录中使用的任务类型字符串
const getTaskTypeString = (): string => {
  return props.taskType || 'Task1'
}

// 添加对批改进度状态的监听
watch(() => feedbackProgressVisible.value, (newVisible) => {
  console.log(`【${getTaskTypeString()}】feedbackProgressVisible 变化: ${newVisible}`)
})

watch(() => currentFeedbackId.value, (newId) => {
  console.log(`【${getTaskTypeString()}】currentFeedbackId 变化: ${newId}`)
})

// 添加当前版本号的计算属性
const currentVersionNumber = computed(() => {
  return props.versions.length + 1
})

// 在 script setup 中添加处理函数
const handleRefreshList = () => {
  // 通知父组件刷新列表
  emit('refresh')
}

// 添加范文相关状态
const showExampleEssay = ref(false)
const exampleEssayContent = ref<string>('')
const exampleEssayImprovement = ref<string>('')
const isLoadingExampleEssay = ref(false)
const exampleEssaySplitRatio = ref(50) // 默认50%分割
const isSplitterDragging = ref(false) // 分隔线拖动状态

// 处理拖动分割线调整比例
const handleSplitDrag = (event: MouseEvent) => {
  const container = document.querySelector('.essay-text-split-container')
  if (!container) return
  
  const containerRect = container.getBoundingClientRect()
  const containerWidth = containerRect.width
  const offsetX = event.clientX - containerRect.left
  
  // 计算百分比（限制在30%-70%之间）
  let percentage = Math.round((offsetX / containerWidth) * 100)
  percentage = Math.max(30, Math.min(70, percentage))
  
  exampleEssaySplitRatio.value = percentage
}

// 添加拖动事件监听
onMounted(() => {
  // 监听鼠标移动和释放事件
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
})

// 移除事件监听
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
})

// 处理分隔线点击开始
const handleSplitterMouseDown = (event: MouseEvent) => {
  // 防止冒泡，避免父元素的点击事件被触发
  event.preventDefault()
  event.stopPropagation()
  
  // 设置拖动状态
  isSplitterDragging.value = true
  
  // 禁用文本选择功能
  document.body.classList.add('no-select')
  
  // 设置光标样式为拖动
  document.body.style.cursor = 'col-resize'
}

// 处理鼠标移动
const handleMouseMove = (event: MouseEvent) => {
  if (isSplitterDragging.value) {
    handleSplitDrag(event)
  }
}

// 处理鼠标释放
const handleMouseUp = () => {
  if (isSplitterDragging.value) {
    isSplitterDragging.value = false
    
    // 恢复文本选择功能
    document.body.classList.remove('no-select')
    
    // 恢复光标样式
    document.body.style.cursor = 'default'
  }
}

// 获取范文内容
const fetchExampleEssay = async () => {
  if (!currentVersion.value || !props.currentProject.id) return
  
  isLoadingExampleEssay.value = true
  
  try {
    const projectId = typeof props.currentProject.id === 'string' ? parseInt(props.currentProject.id) : props.currentProject.id
    const versionNumber = currentVersion.value.versionNumber
    
    try {
      const exampleEssay = await projectApi.getExampleEssay(projectId, versionNumber)
      
      if (exampleEssay) {
        // 检查返回的数据结构
        console.log('获取到的范文数据:', exampleEssay)
        
        // 处理不同的数据结构
        if (exampleEssay.exampleContent) {
          // 如果返回的是数组，则连接成字符串
          if (Array.isArray(exampleEssay.exampleContent)) {
            exampleEssayContent.value = exampleEssay.exampleContent.join('\n\n')
          } else {
            exampleEssayContent.value = exampleEssay.exampleContent
          }
        } else if (exampleEssay.content) {
          // 兼容原有结构
          exampleEssayContent.value = exampleEssay.content
        } else {
          throw new Error('范文数据格式不正确')
        }
        
        // 处理改进建议
        exampleEssayImprovement.value = exampleEssay.improvement || ''
        
        // 确认有范文数据后再显示范文区域
        showExampleEssay.value = true
        
        // 使标题淡入
        setTimeout(() => {
          const titles = document.querySelectorAll('.content-title');
          titles.forEach(title => {
            if (title instanceof HTMLElement) {
              title.style.opacity = '1';
            }
          });
        }, 100);
      } else {
        throw new Error('未找到范文数据')
      }
    } catch (error: any) {
      // 捕获404错误或其他错误
      console.error('获取范文失败:', error)
      
      // 检查是否是404错误（范文不存在）
      const isNotFoundError = 
        (typeof error.toString === 'function' && error.toString().includes('404')) || 
        (error.response && error.response.status === 404);
      
      if (isNotFoundError) {
        ElMessage.info('当前版本没有范文可展示')
      } else {
        ElMessage.error('获取范文失败，请稍后重试')
      }
    }
  } finally {
    isLoadingExampleEssay.value = false
  }
}

// 切换范文显示
const toggleExampleEssay = async () => {
  if (!showExampleEssay.value) {
    // 如果AI面板已打开并且范文将被打开，关闭AI面板
    // 这里不关闭AI面板，而是让范文覆盖在AI面板上方
    
    // 如果还没有加载范文，需要先获取
    if (!exampleEssayContent.value) {
      await fetchExampleEssay()
    } else {
      // 已有数据，直接显示
      showExampleEssay.value = true
      
      // 使标题淡入
      setTimeout(() => {
        const titles = document.querySelectorAll('.content-title');
        titles.forEach(title => {
          if (title instanceof HTMLElement) {
            title.style.opacity = '1';
          }
        });
      }, 100);
    }
  } else {
    // 隐藏范文
    // 先淡出标题
    const titles = document.querySelectorAll('.content-title');
    titles.forEach(title => {
      if (title instanceof HTMLElement) {
        title.style.opacity = '0';
      }
    });
    
    // 等待标题淡出后再隐藏范文
    setTimeout(() => {
      showExampleEssay.value = false
    }, 300);
  }
}

// 处理范文内容的显示格式
const formattedExampleEssay = computed(() => {
  if (!exampleEssayContent.value) return []
  
  // 按段落分割
  return exampleEssayContent.value
    .split(/\n\n+/)
    .filter(p => p.trim().length > 0)
    .map(p => p.trim())
})

// 监听版本变化，清除范文数据
watch(() => currentVersionIndex.value, () => {
  showExampleEssay.value = false
  exampleEssayContent.value = ''
  exampleEssayImprovement.value = ''
  showImprovementPanel.value = false // 版本切换时关闭面板
})

// 添加改进建议面板状态
const showImprovementPanel = ref(false)

// 打开/关闭改进建议面板(切换状态)
const toggleImprovementPanel = () => {
  showImprovementPanel.value = !showImprovementPanel.value
}

// 关闭改进建议面板
const closeImprovementPanel = () => {
  showImprovementPanel.value = false
}

// 添加对Markdown内容的渲染
const renderMarkdown = (content: string) => {
  if (!content) return ''
  try {
    return marked(content)
  } catch (error) {
    console.error('Markdown渲染错误:', error)
    return content
  }
}

// 添加AI对话面板相关状态
const showAIChatPanel = ref(false)
const chatMessages = ref<{
  id: string,
  role: 'user' | 'assistant' | 'system', 
  content: string,
  status?: 'sending' | 'sent' | 'error',
  timestamp: number
}[]>([])
const chatInputValue = ref('')
const isSendingMessage = ref(false)
const isRobotVisible = ref(true)
const aiTyping = ref(false)
const currentSessionId = ref<string>('')
// 添加变量保存当前流请求的取消函数
const currentStreamCancelFn = ref<(() => void) | null>(null)
// 添加存储消息请求ID的变量
const currentRequestId = ref<string>('')

// 生成唯一ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 定义加载聊天历史的方法
const loadChatHistory = async () => {
  try {
    if (!props.currentProject.id || !currentVersion.value) {
      console.error('加载聊天历史失败: 缺少项目ID或版本信息');
      return;
    }
    
    const projectId = typeof props.currentProject.id === 'string' 
      ? parseInt(props.currentProject.id) 
      : props.currentProject.id;
    const versionNumber = currentVersion.value.versionNumber;
    
    // 如果已有会话ID并且不为空
    if (currentSessionId.value) {
      try {
        // 使用已有的会话ID获取历史
        const sessionHistory = await chatApi.getChatHistory(projectId, versionNumber, currentSessionId.value);
        
        if (sessionHistory && sessionHistory.length > 0) {
          // 转换为前端使用的格式
          chatMessages.value = sessionHistory.map((msg: { 
            message_id: string; 
            role: 'user' | 'assistant' | 'system'; 
            content: string; 
            status: 'sending' | 'sent' | 'error';
            created_at: string;
          }) => {
            // 将数据库中的sending状态消息修正为sent状态
            const status = msg.status === 'sending' ? 'sent' : msg.status;
            
            return {
              id: msg.message_id,
              role: msg.role,
              content: msg.content,
              status: status,
              timestamp: new Date(msg.created_at).getTime()
            };
          });
          return; // 已成功加载，直接返回
        }
      } catch (err) {
        console.error(`使用会话ID [${currentSessionId.value}] 加载聊天历史失败:`, err);
        // 会话ID无效，继续尝试获取所有聊天记录
      }
    }
    
    // 先尝试获取对应版本的所有聊天记录（不传sessionId）
    const history = await chatApi.getChatHistory(projectId, versionNumber);
    
    if (history && history.length > 0) {
      // 如果有聊天记录，获取第一条记录的sessionId
      if (history[0].session_id) {
        currentSessionId.value = history[0].session_id;
      }
      
      // 转换为前端使用的格式
      chatMessages.value = history.map((msg: { 
        message_id: string; 
        role: 'user' | 'assistant' | 'system'; 
        content: string; 
        status: 'sending' | 'sent' | 'error';
        created_at: string;
      }) => {
        // 将数据库中的sending状态消息修正为sent状态
        const status = msg.status === 'sending' ? 'sent' : msg.status;
        
        return {
          id: msg.message_id,
          role: msg.role,
          content: msg.content,
          status: status,
          timestamp: new Date(msg.created_at).getTime()
        };
      });
      
      // 有聊天记录时，不显示欢迎消息
    } else {
      // 没有聊天记录时，创建新会话
      try {
        // 创建新会话ID
        const newSessionId = await chatApi.createChatSession(projectId, versionNumber);
        currentSessionId.value = newSessionId;
        
        // 获取新创建的会话（应该包含欢迎消息）
        const newSessionHistory = await chatApi.getChatHistory(projectId, versionNumber, newSessionId);
        
        if (newSessionHistory && newSessionHistory.length > 0) {
          // 转换为前端使用的格式
          chatMessages.value = newSessionHistory.map((msg: { 
            message_id: string; 
            role: 'user' | 'assistant' | 'system'; 
            content: string; 
            status: 'sending' | 'sent' | 'error';
            created_at: string;
          }) => {
            // 将数据库中的sending状态消息修正为sent状态
            const status = msg.status === 'sending' ? 'sent' : msg.status;
            
            return {
              id: msg.message_id,
              role: msg.role,
              content: msg.content,
              status: status,
              timestamp: new Date(msg.created_at).getTime()
            };
          });
          return;
        }
        
        // 如果获取新会话历史失败，回退到本地添加欢迎消息
        chatMessages.value = [];
        addWelcomeMessage();
      } catch (createError) {
        console.error('创建新聊天会话失败，回退到本地欢迎消息:', createError);
        resetChatSession();
        addWelcomeMessage();
      }
    }
  } catch (error) {
    console.error('加载聊天历史失败:', error);
    
    // 加载失败时，重置会话并添加欢迎消息
    resetChatSession();
    addWelcomeMessage();
  }
}

// 重置对话
const resetChat = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有对话记录吗？删除后将无法恢复。', '确认重置', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    
    if (!currentSessionId.value) {
      ElMessage.warning('没有可删除的聊天记录');
      return;
    }
    
    try {
      // 调用后端API删除会话记录
      await chatApi.deleteSession(currentSessionId.value);
      
      // 创建新会话
      const projectId = typeof props.currentProject.id === 'string' 
        ? parseInt(props.currentProject.id) 
        : props.currentProject.id;
      const versionNumber = currentVersion.value?.versionNumber || 1;
      
      // 创建新会话并获取新的会话ID
      currentSessionId.value = await chatApi.createChatSession(projectId, versionNumber);
      
      // 重新加载聊天历史（应该只包含欢迎消息）
      await loadChatHistory();
      
      // 显示成功消息
      ElMessage.success('聊天记录已清空');
    } catch (error) {
      console.error('删除聊天记录失败:', error);
      ElMessage.error('删除聊天记录失败，请重试');
    }
  } catch {
    // 用户取消重置
  }
}

// 监听版本变化，重新加载聊天历史
watch(() => currentVersionIndex.value, async () => {
  // 只有在聊天面板打开的情况下才重新加载
  if (showAIChatPanel.value) {
    // 清空当前会话ID，重新加载聊天历史
    currentSessionId.value = '';
    await loadChatHistory();
  }
});

// 打开AI对话面板
const openAIChatPanel = async () => {
  showAIChatPanel.value = true;
  isRobotVisible.value = false;
  
  try {
    // 如果已有会话ID，则使用已有会话ID加载历史
    // 否则，重新初始化聊天历史
    await loadChatHistory();
    
    // 聚焦输入框
    setTimeout(() => {
      const inputEl = document.querySelector('.chat-input textarea');
      if (inputEl instanceof HTMLElement) {
        inputEl.focus();
      }
    }, 100);
  } catch (error) {
    console.error('初始化聊天失败:', error);
    ElMessage.error('初始化聊天失败，请重试');
  }
}

// 关闭AI对话面板
const closeAIChatPanel = () => {
  // 如果有流式请求在进行中，先取消
  cancelStreamRequest()
  
  showAIChatPanel.value = false
  isRobotVisible.value = true
}

// 发送消息
const sendMessage = async () => {
  const trimmedMessage = chatInputValue.value.trim()
  if (!trimmedMessage || isSendingMessage.value) return
  
  // 清空输入框
  chatInputValue.value = ''
  
  try {
    isSendingMessage.value = true
    
    // 处理文章内容，确保它是字符串类型
    let essayContent = ''
    if (currentVersion.value?.content) {
      if (Array.isArray(currentVersion.value.content)) {
        essayContent = currentVersion.value.content.join('\n\n')
      } else if (typeof currentVersion.value.content === 'string') {
        essayContent = currentVersion.value.content
      }
    }
    
    // 创建一个用户消息对象
    const userMessage = {
      id: generateId(),
      role: 'user' as const,
      content: trimmedMessage,
      timestamp: Date.now(),
      status: 'sent' as const
    }
    
    // 立即添加用户消息到列表
    chatMessages.value.push(userMessage)
    
    // 添加一个空的AI回复占位消息
    const assistantMessage = {
      id: '', // 暂时为空，稍后由服务器返回的messageId替换
      role: 'assistant' as const,
      content: '',
      timestamp: Date.now(),
      status: 'sending' as const
    }
    
    // 添加AI消息到列表
    chatMessages.value.push(assistantMessage)
    
    // 滚动到底部
    scrollToBottom()
    
    // 开启AI输入状态
    aiTyping.value = true
    
    // 使用流式API发送消息
    const cancelStreamFn = chatApi.sendMessageStream({
      projectId: Number(props.currentProject.id),
      versionNumber: currentVersion.value?.versionNumber || 1,
      sessionId: currentSessionId.value,
      message: trimmedMessage,
      taskType: props.taskType?.toLowerCase() || 'task1',
      title: typeof props.currentProject?.title === 'string' ? props.currentProject.title : '',
      content: essayContent
    }, {
      // 收到初始化消息
      onStart: (messageId, requestId) => {
        // 保存请求ID
        currentRequestId.value = requestId
        
        // 更新占位消息ID
        const assistantMsgIndex = chatMessages.value.findIndex(
          msg => msg.role === 'assistant' && msg.status === 'sending' && msg.content === ''
        )
        if (assistantMsgIndex >= 0) {
          chatMessages.value[assistantMsgIndex].id = messageId
        }
      },
      // 收到内容片段
      onChunk: (chunk) => {
        // 更新对应ID的消息内容
        const assistantMsgIndex = chatMessages.value.findIndex(
          msg => msg.id === chunk.messageId
        )
        if (assistantMsgIndex >= 0) {
          // 追加内容
          chatMessages.value[assistantMsgIndex].content += chunk.content
          // 滚动到底部
          scrollToBottom()
        }
      },
      // 流式响应完成
      onComplete: () => {
        aiTyping.value = false
        isSendingMessage.value = false
        currentStreamCancelFn.value = null
        
        // 更新所有发送中状态的AI消息为已发送
        chatMessages.value.forEach(msg => {
          if (msg.role === 'assistant' && msg.status === 'sending') {
            msg.status = 'sent'
          }
        })
      },
      // 发生错误
      onError: (error) => {
        console.error('流式聊天错误:', error)
        ElMessage.error('发送消息失败，请重试')
        
        aiTyping.value = false
        isSendingMessage.value = false
        currentStreamCancelFn.value = null
        
        // 更新所有发送中状态的AI消息为错误状态
        chatMessages.value.forEach(msg => {
          if (msg.role === 'assistant' && msg.status === 'sending') {
            msg.status = 'error'
            msg.content = '抱歉，处理您的请求时出现了问题，请稍后重试。'
          }
        })
      }
    })
    
    // 保存取消函数，以便在需要时取消流
    currentStreamCancelFn.value = cancelStreamFn
  } catch (error) {
    console.error('发送消息失败:', error)
    ElMessage.error('发送消息失败，请重试')
    
    aiTyping.value = false
    isSendingMessage.value = false
  }
}

// 取消发送中的流请求
const cancelStreamRequest = () => {
  if (currentStreamCancelFn.value) {
    currentStreamCancelFn.value()
    currentStreamCancelFn.value = null
    
    // 更新所有发送中状态的AI消息为取消状态
    chatMessages.value.forEach(msg => {
      if (msg.role === 'assistant' && msg.status === 'sending') {
        msg.status = 'error'
        msg.content = '消息发送已取消'
      }
    })
    
    aiTyping.value = false
    isSendingMessage.value = false
  }
}

// 滚动到底部
const scrollToBottom = () => {
  setTimeout(() => {
    const chatBody = document.querySelector('.chat-messages')
    if (chatBody) {
      chatBody.scrollTop = chatBody.scrollHeight
    }
  }, 50)
}

// 删除消息及其后续响应
const deleteMessage = async (messageId: string) => {
  try {
    await ElMessageBox.confirm('删除此消息将同时删除AI的回复，确定要删除吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    try {
      // 调用后端API删除消息
      await chatApi.deleteMessage(messageId);
      
      // 找到消息索引
      const msgIndex = chatMessages.value.findIndex(msg => msg.id === messageId)
      if (msgIndex >= 0) {
        // 从UI中删除该消息
        chatMessages.value.splice(msgIndex, 1)
        
        // 如果后面紧跟着助手消息，也一并删除UI中的显示
        if (msgIndex < chatMessages.value.length && chatMessages.value[msgIndex]?.role === 'assistant') {
          // 获取助手消息ID
          const assistantMessageId = chatMessages.value[msgIndex].id;
          // 从后端删除助手消息
          await chatApi.deleteMessage(assistantMessageId).catch(err => console.error('删除助手消息失败:', err));
          // 从UI中删除
          chatMessages.value.splice(msgIndex, 1)
        }
      }
      
      ElMessage.success('消息已删除');
    } catch (error) {
      console.error('删除消息失败:', error);
      ElMessage.error('删除消息失败，请重试');
    }
  } catch {
    // 用户取消删除
  }
}

// 输入框按键事件处理
const handleKeyDown = (e: KeyboardEvent) => {
  // 按Enter发送消息(不按Shift)
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// 监听对话面板开关状态
watch(() => showAIChatPanel.value, (newVal) => {
  if (newVal) {
    // 面板打开时滚动到底部
    scrollToBottom()
  }
})

// 监听聊天消息变化，自动滚动到底部
watch(() => chatMessages.value.length, () => {
  scrollToBottom()
})

// 重置聊天会话
const resetChatSession = async () => {
  try {
    // 生成新的会话ID
    if (props.currentProject.id && currentVersion.value) {
      const projectId = typeof props.currentProject.id === 'string' 
        ? parseInt(props.currentProject.id) 
        : props.currentProject.id;
      const versionNumber = currentVersion.value.versionNumber;
      
      // 创建新会话ID
      currentSessionId.value = await chatApi.createChatSession(projectId, versionNumber);
    } else {
      // 如果项目ID或版本不存在，生成随机会话ID
      currentSessionId.value = generateId();
    }
    
    // 清空聊天记录
    chatMessages.value = [];
  } catch (error) {
    console.error('重置聊天会话失败:', error);
    // 生成随机会话ID作为备用
    currentSessionId.value = generateId();
    chatMessages.value = [];
  }
}

// 添加欢迎消息
const addWelcomeMessage = () => {
  chatMessages.value.push({
    id: generateId(),
    role: 'assistant',
    content: '你好！我是你的写作助手，你想了解些什么？可以向我提问关于如何提高作文分数的问题，我会尽力帮助你！',
    timestamp: Date.now(),
    status: 'sent'
  });
}
</script>

<template>
  <el-dialog
    :modelValue="visible"
    @update:modelValue="(val: boolean) => emit('update:visible', val)"
    width="85%"
    class="feedback-dialog custom-dialog"
    header-class="custom-dialog-header"
    :close-on-click-modal="false"
    align-center
    @close="handleClose"
  >
    <template #header>
      <div class="custom-header">
        <div class="title-wrapper">
          <h2>{{ isRewriteMode ? '重写作文' : '作文批改结果' }}</h2>
        </div>
      </div>
    </template>

    <!-- 反馈模式 -->
    <div v-if="!isRewriteMode" class="feedback-container">
      <!-- 左侧内容区域 -->
      <div class="content-panel">
        <div class="essay-header">
          <div class="essay-title-section">
            <!-- 标题内容左侧 (70%) -->
            <div class="title-content-wrapper">
              <div class="title-content">
                <h3>Writing {{ props.taskType || 'Task1' }}</h3>
                <p class="essay-title">{{ currentProject.title }}</p>
              </div>
              <div class="essay-meta">
                <span class="meta-item">
                  <el-icon><Calendar /></el-icon>
                  提交时间：{{ currentVersion ? new Date(currentVersion.createdAt).toISOString().split('T')[0] : '暂无' }}
                </span>
                <span class="meta-item">
                  <el-icon><Star /></el-icon>
                  目标分数：{{ currentFeedbackData.targetScore }}
                  <span v-if="Number(overallScore) >= Number(currentFeedbackData.targetScore)" class="achievement">
                    {{ selectedEmoji }}
                  </span>
                  <span v-else class="encouragement">
                    {{ selectedPhrase }}
                  </span>
                </span>
              </div>
            </div>
            
            <!-- 图表图片右侧 (30%) -->
            <div class="chart-image-container" v-if="props.taskType === 'Task1' && currentProject.chartImage">
              <div class="chart-thumbnail" @click="handleImageClick(currentProject.chartImage.url)">
                <img :src="currentProject.chartImage.url" alt="图表" />
                <div class="image-overlay">
                  <span>点击放大</span>
                </div>
              </div>
            </div>
            
            <!-- 无图片占位符 -->
            <div class="chart-image-container" v-else-if="props.taskType === 'Task1'">
              <div class="chart-placeholder">
                <el-icon :size="40"><Picture /></el-icon>
                <span>暂无图表</span>
              </div>
            </div>
          </div>
        </div>

        <div class="essay-content">
          <div class="essay-text" :class="{ 'essay-text-split': showExampleEssay }">
            <!-- 分屏展示内容 -->
            <div v-if="showExampleEssay" class="essay-text-split-container" :style="{ '--split-ratio': `${exampleEssaySplitRatio}%` }">
              <!-- 左侧：原文内容 -->
              <div class="essay-original">
                <!-- 原文标题 -->
                <h4 class="content-title original-title" :class="{ 'fade-in': showExampleEssay }">原文</h4>
                
                <!-- 使用批注组件展示文本 -->
                <template v-if="currentVersion && currentFeedbackAnnotations && currentFeedbackAnnotations.length > 0">
                  <div v-for="(paragraph, index) in (currentVersion.content || [])" 
                      :key="index"
                      class="paragraph">
                    <AnnotationHighlighter 
                      :content="paragraph"
                      :annotations="filterAnnotationsForParagraph(paragraph, index)"
                    />
                  </div>
                </template>
                <!-- 没有批注时使用普通渲染 -->
                <template v-else>
                  <p v-for="(paragraph, index) in (currentVersion?.content || [])" 
                    :key="index"
                    class="paragraph">
                    {{ paragraph }}
                  </p>
                </template>
              </div>
              
              <!-- 分隔线 - 简化版本 -->
              <div class="essay-splitter" @mousedown="handleSplitterMouseDown"></div>
              
              <!-- 右侧：范文内容 -->
              <div class="essay-example">
                <!-- 范文标题 -->
                <h4 class="content-title example-title" :class="{ 'fade-in': showExampleEssay }">
                  范文
                  <!-- 修改图标，移除tooltip，添加点击事件 -->
                  <span v-if="exampleEssayImprovement" class="improvement-trigger" @click="toggleImprovementPanel" title="查看改进建议">
                    <el-icon><QuestionFilled /></el-icon>
                  </span>
                </h4>
                
                <template v-if="isLoadingExampleEssay">
                  <div class="example-loading">
                    <el-icon class="is-loading"><svg class="circular" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none"/></svg></el-icon>
                    <span>加载范文中...</span>
                  </div>
                </template>
                <template v-else>
                  <p v-for="(paragraph, index) in formattedExampleEssay" 
                    :key="index"
                    class="paragraph example-paragraph">
                    {{ paragraph }}
                  </p>
                </template>
              </div>
            </div>
            
            <!-- 非分屏模式 -->
            <template v-else>
              <!-- 使用批注组件展示文本 -->
              <template v-if="currentVersion && currentFeedbackAnnotations && currentFeedbackAnnotations.length > 0">
                <div v-for="(paragraph, index) in (currentVersion.content || [])" 
                     :key="index"
                     class="paragraph">
                  <AnnotationHighlighter 
                    :content="paragraph"
                    :annotations="filterAnnotationsForParagraph(paragraph, index)"
                  />
                </div>
              </template>
              <!-- 没有批注时使用普通渲染 -->
              <template v-else>
                <p v-for="(paragraph, index) in (currentVersion?.content || [])" 
                  :key="index"
                  class="paragraph">
                  {{ paragraph }}
                </p>
              </template>
            </template>
          </div>
          
          <!-- 版本控制与范文按钮 -->
          <div class="bottom-controls">
            <!-- 将范文按钮和版本控制放在一个组中 -->
            <div class="controls-group" :class="{ 'example-active': showExampleEssay }">
              <!-- 范文按钮 -->
              <div class="example-essay-control">
                <el-button
                  circle
                  :class="{ 'active': showExampleEssay }"
                  @click="toggleExampleEssay"
                  :title="showExampleEssay ? '关闭范文' : '查看范文'"
                  class="example-btn"
                >
                  <img src="../../assets/example_essay.svg" alt="范文" class="example-icon" />
                </el-button>
              </div>
              
              <!-- 版本控制 -->
              <div v-if="versions.length > 1" class="version-control">
                <el-button 
                  :disabled="currentVersionIndex === 0"
                  @click="handleVersionChange('prev')"
                  class="version-btn"
                >
                  <el-icon><ArrowLeft /></el-icon>
                </el-button>
                <span class="version-info">版本 {{ currentVersionIndex + 1 }}/{{ versions.length }}</span>
                <el-button 
                  :disabled="currentVersionIndex === versions.length - 1"
                  @click="handleVersionChange('next')"
                  class="version-btn"
                >
                  <el-icon><ArrowRight /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧评分面板 -->
      <div class="feedback-panel">
        <!-- 总体评分区域 -->
        <div class="overall-section" :class="{ 'expanded-overall': isOverallFeedbackExpanded }">
          <!-- 使用条件渲染代替CSS隐藏，减少布局问题 -->
          <template v-if="!isOverallFeedbackExpanded">
            <div class="overall-content">
              <div class="score-section">
                <!-- 分数圆圈1 (在反馈模式) -->
                <div class="score-circle" @click="triggerConfetti($event)">
                  <span class="score-number">{{ overallScore }}</span>
                  <span class="score-label">总分</span>
                </div>
                <div v-if="improvementScore" class="improvement-info">
                  <div class="improvement-badge">
                    <el-icon><ArrowUp /></el-icon>
                    提升 {{ improvementScore }} 分
                  </div>
                </div>
              </div>
              
              <div class="overall-feedback" @click="toggleOverallFeedback">
                <h3>总体评价</h3>
                <p class="feedback-text">{{ currentFeedbackData.feedback.overall }}</p>
              </div>
            </div>
          </template>
          
          <template v-else>
            <div class="overall-content expanded-content">
              <div class="overall-feedback expanded" @click="toggleOverallFeedback">
                <h3>总体评价</h3>
                <p class="feedback-text expanded-text">{{ currentFeedbackData.feedback.overall }}</p>
              </div>
            </div>
          </template>
        </div>

        <!-- 维度评分区域 -->
        <div class="dimensions-section">
          <h3 class="section-title">评分维度</h3>
          <div 
            v-for="dim in scoreDimensions" 
            :key="dim.key" 
            class="score-dimension-card"
            :class="{ active: activeDimension === dim.key }"
            @click="toggleDimension(dim.key)"
          >
            <div class="dimension-header">
              <div class="dimension-info">
                <span class="dimension-name">{{ dim.name }}</span>
                <el-tooltip :content="dim.description" placement="top">
                  <el-icon class="info-icon"><InfoFilled /></el-icon>
                </el-tooltip>
              </div>
              <span class="dimension-score">{{ currentFeedbackData.scores[dim.key].toFixed(1) }}</span>
            </div>

            <el-collapse-transition>
              <div v-show="activeDimension === dim.key" class="dimension-detail">
                <p class="detail-text">{{ currentFeedbackData.feedback[dim.key] }}</p>
                <div class="score-trend">
                  <el-progress 
                    :percentage="currentFeedbackData.scores[dim.key] * 11.11" 
                    :stroke-width="8"
                    :show-text="false"
                  />
                </div>
              </div>
            </el-collapse-transition>
          </div>
        </div>
        
        <!-- 移动Robot图标到这里 -->
        <div v-if="isRobotVisible" class="robot-icon" @click="openAIChatPanel">
          <img src="../../assets/robot.svg" alt="AI助手" />
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <div class="button-group">
            <el-button type="primary" @click="handleRetry" title="重试">
              <el-icon><Edit /></el-icon>
              <span class="button-text">再次尝试</span>
            </el-button>
            <el-button type="danger" @click="handleDelete" title="删除">
              <el-icon><Delete /></el-icon>
              <span class="button-text">删除项目</span>
            </el-button>
          </div>
        </div>
        
        <!-- AI对话面板 -->
        <div v-if="showAIChatPanel" class="ai-chat-panel">
          <div class="ai-chat-header">
            <h3>AI随心问</h3>
            <div class="ai-chat-actions">
              <el-button type="primary" text circle @click="resetChat" title="重置对话">
                <el-icon><RefreshRight /></el-icon>
              </el-button>
              <el-button circle text @click="closeAIChatPanel" class="close-btn">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>
          
          <div class="chat-messages">
            <!-- 消息列表 -->
            <div 
              v-for="message in chatMessages" 
              :key="message.id"
              :class="[
                'chat-message', 
                message.role === 'user' ? 'user-message' : 'assistant-message',
                message.status === 'sending' ? 'sending' : ''
              ]"
            >
              <!-- 消息内容 -->
              <div class="message-content">
                <template v-if="message.role === 'user'">
                  <p>{{ message.content }}</p>
                </template>
                <template v-else>
                  <div v-html="renderMarkdown(message.content)" class="markdown-content"></div>
                </template>
                <div v-if="message.status === 'sending'" class="message-status">
                  <span>发送中...</span>
                </div>
              </div>
              
              <!-- 用户消息操作按钮 - 放在消息下方 -->
              <div v-if="message.role === 'user'" class="message-actions">
                <div class="action-buttons-row">
                  <span class="action-button delete-button" @click="deleteMessage(message.id)" title="删除">
                    <el-icon><Delete /></el-icon>
                  </span>
                </div>
              </div>
            </div>
            
            <!-- AI正在输入提示 -->
            <div v-if="aiTyping" class="ai-typing">
              <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
          
          <div class="chat-input-container">
            <!-- 输入框 -->
            <div class="chat-input">
              <el-input
                v-model="chatInputValue"
                type="textarea"
                :rows="3"
                resize="none"
                placeholder="输入你的问题..."
                @keydown="handleKeyDown"
              />
              
              <el-button 
                type="primary" 
                circle 
                class="send-button" 
                @click="sendMessage" 
                :disabled="!chatInputValue.trim() || isSendingMessage"
              >
                <el-icon><ChatDotRound /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
        
        <!-- 改进建议面板 (放在feedback-panel内部) -->
        <div v-if="showImprovementPanel" class="improvement-panel">
          <div class="improvement-panel-header">
            <h3>改进建议</h3>
            <el-button circle text @click="closeImprovementPanel" class="close-btn">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
          <div class="improvement-panel-content">
            <template v-if="exampleEssayImprovement">
              <!-- 直接渲染Markdown内容，不再嵌套在improvement-content中 -->
              <div v-html="renderMarkdown(exampleEssayImprovement)" class="markdown-content"></div>
            </template>
            <template v-else>
              <div class="empty-improvement">
                <el-icon :size="40"><QuestionFilled /></el-icon>
                <p>暂无改进建议</p>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 重写模式 -->
    <div v-else class="rewrite-container feedback-container">
      <!-- 左侧内容区域 -->
      <div class="content-panel">
        <div class="essay-header">
          <div class="essay-title-section">
            <!-- 标题内容左侧 (70%) -->
            <div class="title-content-wrapper">
              <div class="title-content">
                <h3>Writing {{ props.taskType || 'Task1' }}</h3>
                <p class="essay-title">{{ currentProject.title }}</p>
              </div>
              <div class="essay-meta">
                <span class="meta-item">
                  <el-icon><Calendar /></el-icon>
                  提交时间：{{ currentVersion ? new Date(currentVersion.createdAt).toISOString().split('T')[0] : '暂无' }}
                </span>
                <span class="meta-item">
                  <el-icon><Star /></el-icon>
                  目标分数：{{ currentFeedbackData.targetScore }}
                  <span v-if="Number(overallScore) >= Number(currentFeedbackData.targetScore)" class="achievement">
                    {{ selectedEmoji }}
                  </span>
                  <span v-else class="encouragement">
                    {{ selectedPhrase }}
                  </span>
                </span>
              </div>
            </div>
            
            <!-- 图表图片右侧 (30%) -->
            <div class="chart-image-container" v-if="props.taskType === 'Task1' && currentProject.chartImage">
              <div class="chart-thumbnail" @click="handleImageClick(currentProject.chartImage.url)">
                <img :src="currentProject.chartImage.url" alt="图表" />
                <div class="image-overlay">
                  <span>点击放大</span>
                </div>
              </div>
            </div>
            
            <!-- 无图片占位符 -->
            <div class="chart-image-container" v-else-if="props.taskType === 'Task1'">
              <div class="chart-placeholder">
                <el-icon :size="40"><Picture /></el-icon>
                <span>暂无图表</span>
              </div>
            </div>
          </div>
        </div>

        <div class="essay-content">
          <!-- 文本输入框 -->
          <div class="essay-input-container">
            <el-input
              v-model="essayContent"
              type="textarea"
              :rows="15"
              resize="none"
              placeholder="请在这里重写您的作文..."
              class="essay-textarea"
            />
            <div class="word-counter" :class="{ 'warning': contentRemaining < 50 }">
              {{ contentWordCount }} / {{ contentLimit }}
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧评分面板 -->
      <div class="feedback-panel">
        <!-- 总体评分区域 -->
        <div class="overall-section" :class="{ 'expanded-overall': isOverallFeedbackExpanded }">
          <!-- 使用条件渲染代替CSS隐藏，减少布局问题 -->
          <template v-if="!isOverallFeedbackExpanded">
            <div class="overall-content">
              <div class="score-section">
                <!-- 分数圆圈2 (在重写模式) -->
                <div class="score-circle" @click="triggerConfetti($event)">
                  <span class="score-number">{{ overallScore }}</span>
                  <span class="score-label">当前分数</span>
                </div>
                <div v-if="improvementScore" class="improvement-info">
                  <div class="improvement-badge">
                    <el-icon><ArrowUp /></el-icon>
                    提升 {{ improvementScore }} 分
                  </div>
                </div>
              </div>
              
              <div class="overall-feedback" @click="toggleOverallFeedback">
                <h3>总体评价</h3>
                <p class="feedback-text">{{ currentFeedbackData.feedback.overall }}</p>
              </div>
            </div>
          </template>
          
          <template v-else>
            <div class="overall-content expanded-content">
              <div class="overall-feedback expanded" @click="toggleOverallFeedback">
                <h3>总体评价</h3>
                <p class="feedback-text expanded-text">{{ currentFeedbackData.feedback.overall }}</p>
              </div>
            </div>
          </template>
        </div>

        <!-- 维度评分区域 -->
        <div class="dimensions-section">
          <h3 class="section-title">上次评分维度</h3>
          <div 
            v-for="dim in scoreDimensions" 
            :key="dim.key" 
            class="score-dimension-card"
            :class="{ active: activeDimension === dim.key }"
            @click="toggleDimension(dim.key)"
          >
            <div class="dimension-header">
              <div class="dimension-info">
                <span class="dimension-name">{{ dim.name }}</span>
                <el-tooltip :content="dim.description" placement="top">
                  <el-icon class="info-icon"><InfoFilled /></el-icon>
                </el-tooltip>
              </div>
              <span class="dimension-score">{{ currentFeedbackData.scores[dim.key].toFixed(1) }}</span>
            </div>

            <el-collapse-transition>
              <div v-show="activeDimension === dim.key" class="dimension-detail">
                <p class="detail-text">{{ currentFeedbackData.feedback[dim.key] }}</p>
                <div class="score-trend">
                  <el-progress 
                    :percentage="currentFeedbackData.scores[dim.key] * 11.11" 
                    :stroke-width="8"
                    :show-text="false"
                  />
                </div>
              </div>
            </el-collapse-transition>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <div class="button-group">
            <el-button type="default" @click="handleRewriteCancel" title="取消">
              <el-icon><Close /></el-icon>
              <span class="button-text">取消</span>
            </el-button>
            <el-button type="primary" @click="handleRewriteSubmit" title="提交">
              <el-icon><Check /></el-icon>
              <span class="button-text">提交</span>
            </el-button>
          </div>
        </div>
      </div>
    </div>

  </el-dialog>
  
  <!-- 处理进度对话框 -->
  <FeedbackProgress
    v-if="feedbackProgressVisible && currentFeedbackId > 0"
    v-model:visible="feedbackProgressVisible"
    :feedback-id="currentFeedbackId"
    :project-id="Number(currentProject.id)"
    :version-number="currentVersionNumber"
    :project-title="currentProject.title"
    @completed="handleFeedbackCompleted"
    @failed="handleFeedbackFailed"
    @open-feedback-dialog="handleOpenFeedbackDialog"
    @refresh-list="handleRefreshList"
  />
  
  <!-- 图片预览对话框 -->
  <el-dialog 
    v-model="showImagePreview" 
    append-to-body 
    :modal-append-to-body="false"
    :show-close="true"
    class="image-preview-dialog"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    top="5vh"
    align-center
  >
    <div class="image-preview-container">
      <img :src="imageUrl" alt="图表预览" class="preview-image" @click="closeImagePreview" />
    </div>
  </el-dialog>
</template>

<style scoped>
@import './IELTSFeedbackDialog.css';
</style>