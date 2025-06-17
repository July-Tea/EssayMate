import { DataSource } from "typeorm";
import { Config } from "./models/Config";
import { GeneralSettings } from "./models/GeneralSettings";
import { Database } from 'sqlite3';

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: "database.sqlite",
  synchronize: true,
  logging: false,
  entities: [Config, GeneralSettings],
  migrations: [],
  subscribers: []
});

let isInitializing = false;
let isInitialized = false;

// 创建SQLite数据库连接实例
let dbConnection: Database;

// 获取数据库连接
export function getDatabaseConnection(): Database {
  if (!dbConnection) {
    dbConnection = new Database('./database.sqlite');
  }
  return dbConnection;
}

// 将getDatabaseConnection方法添加到AppDataSource对象
(AppDataSource as any).getDatabaseConnection = getDatabaseConnection;

export const initializeDatabase = async (retries = 5): Promise<void> => {
  if (isInitialized) {
    return;
  }

  if (isInitializing) {
    // 等待其他初始化完成
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  try {
    isInitializing = true;
    
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log("数据源已初始化!");

      // 强制同步数据库结构，确保应用model字段的唯一约束
      try {
        console.log("正在同步数据库结构以应用最新的索引和约束...");
        await AppDataSource.synchronize();
        console.log("数据库结构同步完成!");
      } catch (syncError) {
        console.error("同步数据库结构失败:", syncError);
      }

      // 尝试同步数据库结构
      try {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        
        // 检查配置表是否存在
        const configTableExists = await queryRunner.hasTable("config");
        
        if (!configTableExists) {
          console.log("正在创建配置表...");
          await AppDataSource.synchronize();
          console.log("配置表创建成功!");
        } else {
          console.log("配置表已存在，检查表结构...");
          // 验证表结构
          const columns = await queryRunner.getTable("config");
          if (columns) {
            const requiredColumns = ['id', 'model', 'apiKey', 'modelConfigs', 'is_active', 'created_at', 'updated_at', 'programState'];
            const missingColumns = requiredColumns.filter(col => 
              !columns.findColumnByName(col)
            );
            
            // 检查列结构变更
            const legacyColumns = ['updatedAt', 'isReset'];
            const legacyColumnsExists = legacyColumns.filter(col => 
              columns.findColumnByName(col)
            );
            
            if (missingColumns.length > 0 || legacyColumnsExists.length > 0) {
              console.log("检测到Config表结构需要更新，正在更新...");
              
              // 如果表存在但结构不完整，我们需要备份数据
              let existingConfigs = [];
              if (missingColumns.includes('is_active') || legacyColumnsExists.includes('updatedAt')) {
                try {
                  const result = await queryRunner.query("SELECT * FROM config");
                  existingConfigs = result || [];
                  console.log(`找到${existingConfigs.length}条现有配置记录，准备迁移...`);
                } catch (err) {
                  console.error("读取现有配置失败:", err);
                }
              }
              
              // 使用TypeORM同步器更新表结构
              await AppDataSource.synchronize();
              
              // 如果有现有数据，则更新到新表结构
              if (existingConfigs.length > 0) {
                console.log("正在迁移现有配置数据...");
                
                try {
                  for (const oldConfig of existingConfigs) {
                    // 构建新的配置对象
                    const newConfig = {
                      model: oldConfig.model || '',
                      apiKey: oldConfig.apiKey || '',
                      modelConfigs: oldConfig.modelConfigs || '{}',
                      is_active: true, // 默认将旧记录设为活动
                      programState: oldConfig.programState || null
                    };
                    
                    // 插入新的配置记录
                    await queryRunner.query(
                      `INSERT INTO config (model, apiKey, modelConfigs, is_active, programState) 
                       VALUES (?, ?, ?, ?, ?)`,
                      [
                        newConfig.model,
                        newConfig.apiKey,
                        typeof newConfig.modelConfigs === 'string' ? newConfig.modelConfigs : JSON.stringify(newConfig.modelConfigs),
                        newConfig.is_active ? 1 : 0,
                        newConfig.programState ? JSON.stringify(newConfig.programState) : null
                      ]
                    );
                  }
                  console.log("配置数据迁移完成!");
                } catch (migrationError) {
                  console.error("迁移配置数据失败:", migrationError);
                }
              }
              
              console.log("Config表结构更新完成!");
            }
          }
        }
        
        // 检查项目表是否存在
        const projectsTableExists = await queryRunner.hasTable("projects");
        
        if (!projectsTableExists) {
          console.log("正在创建项目表...");
          await queryRunner.query(`
            CREATE TABLE projects (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              prompt TEXT NOT NULL,
              exam_type TEXT NOT NULL,
              category TEXT NOT NULL,
              target_score TEXT,
              current_version INTEGER NOT NULL DEFAULT 1,
              status TEXT NOT NULL DEFAULT 'draft',
              total_versions INTEGER NOT NULL DEFAULT 1,
              chart_image TEXT,
              is_del INTEGER NOT NULL DEFAULT 0,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
          `);
          console.log("项目表创建成功!");
        } else {
          console.log("项目表已存在，检查表结构...");
          // 验证表结构
          const projectsTable = await queryRunner.getTable("projects");
          if (projectsTable) {
            const requiredColumns = ['id', 'title', 'prompt', 'exam_type', 'category', 'target_score', 'current_version', 'status', 'total_versions', 'chart_image', 'is_del', 'created_at', 'updated_at'];
            const missingColumns = requiredColumns.filter(col => 
              !projectsTable.findColumnByName(col)
            );
            
            if (missingColumns.length > 0) {
              console.log("检测到项目表结构不完整，正在更新...");
              for (const column of missingColumns) {
                if (column === 'is_del') {
                  await queryRunner.query(`ALTER TABLE projects ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`);
                } else if (column === 'target_score' || column === 'current_version' || column === 'status' || column === 'total_versions') {
                  await queryRunner.query(`ALTER TABLE projects ADD COLUMN ${column} TEXT`);
                } else if (column === 'created_at' || column === 'updated_at') {
                  await queryRunner.query(`ALTER TABLE projects ADD COLUMN ${column} DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`);
                } else if (column === 'chart_image') {
                  await queryRunner.query(`ALTER TABLE projects ADD COLUMN ${column} TEXT`);
                } else {
                  await queryRunner.query(`ALTER TABLE projects ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
                }
              }
              console.log("项目表结构更新完成!");
            }
          }
        }
        
        // 检查文章版本表是否存在
        const essayVersionsTableExists = await queryRunner.hasTable("essay_versions");
        if (!essayVersionsTableExists) {
          console.log("正在创建文章版本表...");
          await queryRunner.query(`
            CREATE TABLE essay_versions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              project_id INTEGER NOT NULL,
              version_number INTEGER NOT NULL,
              content TEXT NOT NULL,
              word_count INTEGER NOT NULL,
              status TEXT NOT NULL,
              is_del INTEGER NOT NULL DEFAULT 0,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
              UNIQUE(project_id, version_number)
            )
          `);
          await queryRunner.query(`
            CREATE INDEX idx_essay_versions_project ON essay_versions(project_id, version_number)
          `);
          console.log("文章版本表创建成功!");
        }
        
        // 检查范文表是否存在
        const exampleEssaysTableExists = await queryRunner.hasTable("example_essays");
        if (!exampleEssaysTableExists) {
          console.log("正在创建范文表...");
          await queryRunner.query(`
            CREATE TABLE example_essays (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              project_id INTEGER NOT NULL,
              version_number INTEGER NOT NULL,
              example_content TEXT NOT NULL,
              improvement TEXT,
              word_count INTEGER NOT NULL,
              status TEXT NOT NULL,
              is_del INTEGER NOT NULL DEFAULT 0,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
              UNIQUE(project_id, version_number)
            )
          `);
          await queryRunner.query(`
            CREATE INDEX idx_example_essays_project ON example_essays(project_id, version_number)
          `);
          console.log("范文表创建成功!");
        } else {
          // 检查是否需要添加improvement列
          const tableColumns = await queryRunner.query(`PRAGMA table_info(example_essays)`);
          const hasImprovement = tableColumns.some((column: any) => column.name === 'improvement');
          if (!hasImprovement) {
            console.log("正在向范文表添加improvement列...");
            await queryRunner.query(`ALTER TABLE example_essays ADD COLUMN improvement TEXT`);
            console.log("范文表更新成功!");
          }
        }
        
        // 检查反馈表是否存在
        const feedbacksTableExists = await queryRunner.hasTable("feedbacks");
        if (!feedbacksTableExists) {
          console.log("正在创建反馈表...");
          await queryRunner.query(`
            CREATE TABLE feedbacks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              project_id INTEGER NOT NULL,
              essay_version_id INTEGER NOT NULL,
              version_number INTEGER NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending',
              is_del INTEGER NOT NULL DEFAULT 0,
              
              score_tr DECIMAL(3,1) NOT NULL,
              score_cc DECIMAL(3,1) NOT NULL,
              score_lr DECIMAL(3,1) NOT NULL,
              score_gra DECIMAL(3,1) NOT NULL,
              overall_score DECIMAL(3,1) GENERATED ALWAYS AS (
                CASE 
                  WHEN ((score_tr + score_cc + score_lr + score_gra) / 4.0) - FLOOR((score_tr + score_cc + score_lr + score_gra) / 4.0) >= 0.75 
                  THEN CEIL((score_tr + score_cc + score_lr + score_gra) / 4.0)
                  WHEN ((score_tr + score_cc + score_lr + score_gra) / 4.0) - FLOOR((score_tr + score_cc + score_lr + score_gra) / 4.0) >= 0.25 
                  THEN FLOOR((score_tr + score_cc + score_lr + score_gra) / 4.0) + 0.5
                  ELSE FLOOR((score_tr + score_cc + score_lr + score_gra) / 4.0)
                END
              ) STORED,
              feedback_tr TEXT NOT NULL,
              feedback_cc TEXT NOT NULL,
              feedback_lr TEXT NOT NULL,
              feedback_gra TEXT NOT NULL,
              overall_feedback TEXT,
              
              annotations TEXT,
              improvement_suggestions TEXT,
              
              started_at DATETIME,
              completed_at DATETIME,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              
              FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
              FOREIGN KEY (essay_version_id) REFERENCES essay_versions(id) ON DELETE CASCADE,
              UNIQUE(project_id, version_number)
            )
          `);
          await queryRunner.query(`
            CREATE INDEX idx_feedbacks_project ON feedbacks(project_id, version_number);
            CREATE INDEX idx_feedbacks_essay_version ON feedbacks(essay_version_id);
          `);
          console.log("反馈表创建成功!");
        }
        
        // 检查日志表是否存在
        const promptLogsTableExists = await queryRunner.hasTable("prompt_logs");
        if (!promptLogsTableExists) {
          console.log("正在创建提示日志表...");
          await queryRunner.query(`
            CREATE TABLE prompt_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              request_id TEXT NOT NULL,
              service_type TEXT,
              model_name TEXT,
              request_type TEXT NOT NULL DEFAULT 'feedback',
              paragraph_info TEXT NOT NULL,
              project_id INTEGER,
              version_number INTEGER,
              prompt_content TEXT NOT NULL,
              raw_response TEXT NOT NULL,
              response_content TEXT NOT NULL,
              prompt_tokens INTEGER NOT NULL,
              completion_tokens INTEGER NOT NULL,
              total_tokens INTEGER NOT NULL,
              duration INTEGER NOT NULL,
              status TEXT NOT NULL,
              error_message TEXT,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
          `);
          await queryRunner.query(`
            CREATE INDEX idx_prompt_logs_request_id ON prompt_logs(request_id);
            CREATE INDEX idx_prompt_logs_project ON prompt_logs(project_id, version_number);
            CREATE INDEX idx_prompt_logs_created_at ON prompt_logs(created_at);
          `);
          console.log("提示日志表创建成功!");
        }
        
        // 检查聊天消息表是否存在
        const chatMessagesTableExists = await queryRunner.hasTable("chat_messages");
        if (!chatMessagesTableExists) {
          console.log("正在创建聊天消息表...");
          await queryRunner.query(`
            CREATE TABLE chat_messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              project_id INTEGER NOT NULL,
              version_number INTEGER NOT NULL,
              session_id TEXT NOT NULL,
              parent_id TEXT,
              message_id TEXT NOT NULL,
              role TEXT NOT NULL,
              content TEXT NOT NULL,
              status TEXT NOT NULL,
              error_message TEXT,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
          `);
          await queryRunner.query(`
            CREATE INDEX idx_chat_messages_project ON chat_messages(project_id, version_number);
            CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
          `);
          console.log("聊天消息表创建成功!");
        }
        
        await queryRunner.release();
      } catch (syncError) {
        console.error("数据库同步过程中出错:", syncError);
        throw syncError;
      }
    }
    
    isInitialized = true;
  } catch (error) {
    console.error("数据源初始化过程中出错", error);
    if (retries > 0) {
      console.log(`正在重试数据库初始化... (剩余 ${retries} 次尝试)`);
      isInitializing = false;
      await new Promise(resolve => setTimeout(resolve, 1000));
      await initializeDatabase(retries - 1);
    } else {
      throw error;
    }
  } finally {
    isInitializing = false;
  }
};

// 初始化数据库连接
initializeDatabase().catch(error => {
  console.error("Failed to initialize database after all retries", error);
  process.exit(1);
});