"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  AlertCircle, Play, Trash2, Plus, Bell, Loader2, TrendingUp, 
  Settings, CheckCircle, Clock, FileText, Key, Rss, Wifi, WifiOff,
  ExternalLink, Newspaper, Search, Timer, Calendar, BarChart2, Upload
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, 
  DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StockHolding {
  id: string;
  code: string;
  name: string;
}

interface RSSItem {
  title: string;
  link: string;
  description: string;
  content: string;
  pubDate?: string;
}

interface RSSFeed {
  title: string;
  link: string;
  description: string;
  items: RSSItem[];
  totalCount: number;
}

// 任务类型
type TaskType = 'workflow';
type TaskMode = 'once' | 'daily';
type TaskStatus = 'pending' | 'running' | 'success' | 'failed';

interface CronJob {
  id: string;
  name: string;
  taskType: TaskType;
  taskMode: TaskMode;
  cronExpr?: string;
  runAt?: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  lastResult?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface JobLog {
  id: string;
  jobId: string;
  jobName: string;
  taskType: TaskType;
  status: TaskStatus;
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  result?: string;
  error?: string;
  triggerSource: 'scheduled' | 'manual';
  createdAt: string;
}

interface AvailableTaskType {
  type: TaskType;
  name: string;
  description: string;
}

interface WorkflowEvent {
  type: string;
  timestamp?: number;
  run_id?: string;
  log_id?: string;
  output?: {
    final_report?: string;
  };
  error?: string;
  code?: string;
  message?: string;
  total_events?: number;
}

type ExecutionStatus = "idle" | "connecting" | "running" | "success" | "error";

// 令牌脱敏函数：显示前6位和后4位，中间用*代替
const maskToken = (token: string): string => {
  if (!token || token.length <= 10) return token ? '******' : '';
  const prefix = token.slice(0, 6);
  const suffix = token.slice(-4);
  return `${prefix}...${suffix}`;
};

export default function FinancialAnalysisPage() {
  const router = useRouter();
  // 配置状态
  const [cozeToken, setCozeToken] = useState("");
  const [rssUrl, setRssUrl] = useState("https://wechat2rss.marlinworks.xyz/feed/3589865648.xml");
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [newHoldingCode, setNewHoldingCode] = useState("");
  const [newHoldingName, setNewHoldingName] = useState("");
  
  // 钉钉配置
  const [dingtalkWebhook, setDingtalkWebhook] = useState("");
  const [dingtalkSecret, setDingtalkSecret] = useState("");
  
  // 对话框状态
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showDingtalkDialog, setShowDingtalkDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  // 导入状态
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  
  // 执行状态
  const [status, setStatus] = useState<ExecutionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  
  // RSS 文章状态
  const [rssFeed, setRssFeed] = useState<RSSFeed | null>(null);
  const [isLoadingRSS, setIsLoadingRSS] = useState(false);
  const [rssError, setRssError] = useState<string | null>(null);
  
  // 单篇分析状态
  const [analyzingArticle, setAnalyzingArticle] = useState<RSSItem | null>(null);
  const [articleAnalysisLog, setArticleAnalysisLog] = useState<string[]>([]);
  const [articleReport, setArticleReport] = useState<string | null>(null);
  
  // PDF 上传状态
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  // 定时器状态
  const [showSchedulerDialog, setShowSchedulerDialog] = useState(false);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [jobLogs, setJobLogs] = useState<JobLog[]>([]);
  const [availableTaskTypes, setAvailableTaskTypes] = useState<AvailableTaskType[]>([]);
  const [isLoadingScheduler, setIsLoadingScheduler] = useState(false);
  // 新任务表单状态
  const [newTaskType, setNewTaskType] = useState<TaskType>('workflow');
  const [newTaskMode, setNewTaskMode] = useState<TaskMode>('daily');
  const [newTaskTime, setNewTaskTime] = useState("08:00");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  
  const logRef = useRef<HTMLDivElement>(null);

  // 从环境变量和 localStorage 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      // 先从环境变量获取配置
      let envToken = '';
      let envRssUrl = '';
      
      try {
        const envResponse = await fetch('/api/env-config');
        const envResult = await envResponse.json();
        if (envResult.success && envResult.data) {
          envToken = envResult.data.cozeApiToken || '';
          envRssUrl = envResult.data.rssUrl || '';
        }
      } catch (err) {
        console.error('Failed to load env config:', err);
      }
      
      // 从 localStorage 获取配置
      const savedToken = localStorage.getItem("cozeToken");
      const savedRssUrl = localStorage.getItem("rssUrl");
      const savedWebhook = localStorage.getItem("dingtalkWebhook");
      const savedSecret = localStorage.getItem("dingtalkSecret");
      
      // 优先使用环境变量，其次 localStorage
      const finalToken = envToken || savedToken || '';
      const finalRssUrl = envRssUrl || savedRssUrl || 'https://wechat2rss.marlinworks.xyz/feed/3589865648.xml';
      
      setCozeToken(finalToken);
      setRssUrl(finalRssUrl);
      
      // 如果环境变量有值，同步到 localStorage
      if (envToken) {
        localStorage.setItem('cozeToken', envToken);
      }
      if (envRssUrl) {
        localStorage.setItem('rssUrl', envRssUrl);
      }
      
      if (savedWebhook) setDingtalkWebhook(savedWebhook);
      if (savedSecret) setDingtalkSecret(savedSecret);
      
      // 从数据库加载持仓
      fetchHoldings();
    };
    
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 从数据库获取持仓
  const fetchHoldings = useCallback(async () => {
    try {
      const response = await fetch("/api/holdings");
      const result = await response.json();
      if (result.success && result.data) {
        setHoldings(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch holdings:", err);
    }
  }, []);

  // 解析导入文本
  const parseImportText = (text: string): { code: string; name: string }[] => {
    const lines = text.trim().split('\n');
    const stocks: { code: string; name: string }[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // 支持多种格式：
      // 1. 代码 名称 (空格分隔)
      // 2. 代码,名称 (逗号分隔)
      // 3. 代码\t名称 (制表符分隔)
      let code = '';
      let name = '';
      
      if (trimmed.includes('\t')) {
        const parts = trimmed.split('\t');
        code = parts[0]?.trim() || '';
        name = parts.slice(1).join(' ').trim() || code;
      } else if (trimmed.includes(',')) {
        const parts = trimmed.split(',');
        code = parts[0]?.trim() || '';
        name = parts.slice(1).join(',').trim() || code;
      } else {
        // 空格分隔，代码可能是第一个单词，名称是后面的
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          code = parts[0];
          name = parts.slice(1).join(' ');
        } else {
          code = parts[0] || '';
          name = code;
        }
      }
      
      if (code) {
        stocks.push({ code: code.toUpperCase(), name: name || code });
      }
    }
    
    return stocks;
  };

  // 批量导入股票
  const handleImportStocks = useCallback(async () => {
    const stocks = parseImportText(importText);
    
    if (stocks.length === 0) {
      alert("未解析到有效的股票代码");
      return;
    }
    
    setIsImporting(true);
    
    try {
      const response = await fetch("/api/holdings/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stocks }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 刷新持仓列表
        await fetchHoldings();
        setShowImportDialog(false);
        setImportText("");
        alert(`导入成功！新增 ${result.data.added} 只，跳过 ${result.data.skipped} 只已存在`);
      } else {
        alert(`导入失败: ${result.error}`);
      }
    } catch (err) {
      console.error("Import error:", err);
      alert(`导入失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setIsImporting(false);
    }
  }, [importText, fetchHoldings]);

  // 加载定时任务
  const loadSchedulerTasks = useCallback(async () => {
    setIsLoadingScheduler(true);
    try {
      const response = await fetch("/api/scheduler");
      const result = await response.json();
      
      if (result.success && result.data) {
        setCronJobs(result.data.jobs || []);
        setJobLogs(result.data.logs || []);
        setAvailableTaskTypes(result.data.availableTaskTypes || []);
      }
    } catch (err) {
      console.error("Failed to load scheduler tasks:", err);
    } finally {
      setIsLoadingScheduler(false);
    }
  }, []);

  // 创建定时任务
  const createTask = useCallback(async () => {
    if (!cozeToken) {
      alert("请先配置 Coze 访问令牌");
      return;
    }
    
    setIsCreatingTask(true);
    
    try {
      const taskTypeDef = availableTaskTypes.find(t => t.type === newTaskType);
      const taskName = taskTypeDef?.name || '定时任务';
      
      let cronExpr: string | undefined;
      let runAt: string | undefined;
      let jobId: string;
      let name: string;
      
      if (newTaskMode === 'daily') {
        // 每日循环任务
        const [hours, minutes] = newTaskTime.split(':').map(Number);
        cronExpr = `${minutes} ${hours} * * *`;
        jobId = `${newTaskType}-daily-${hours}-${minutes}`;
        name = `每天${newTaskTime} ${taskName}`;
      } else {
        // 一次性任务
        if (!newTaskDate) {
          alert("请选择执行日期");
          setIsCreatingTask(false);
          return;
        }
        runAt = `${newTaskDate}T${newTaskTime}:00+08:00`;
        jobId = `${newTaskType}-once-${Date.now()}`;
        name = `${newTaskDate} ${newTaskTime} ${taskName}`;
      }
      
      const response = await fetch("/api/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: jobId,
          name,
          taskType: newTaskType,
          taskMode: newTaskMode,
          cronExpr,
          runAt,
          enabled: true,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(newTaskMode === 'daily' 
          ? "定时任务创建成功！将按计划自动执行。" 
          : "一次性任务创建成功！将在指定时间执行后自动删除。"
        );
        await loadSchedulerTasks();
        // 重置表单
        setNewTaskMode('daily');
        setNewTaskDate("");
      } else {
        alert(`创建失败: ${result.error}`);
      }
    } catch (err) {
      console.error("Create task error:", err);
      alert(`创建失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setIsCreatingTask(false);
    }
  }, [newTaskType, newTaskMode, newTaskTime, newTaskDate, cozeToken, availableTaskTypes, loadSchedulerTasks]);

  // 手动触发任务
  const triggerTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/scheduler/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert("任务已触发，正在后台执行，请稍后在执行日志中查看结果");
        await loadSchedulerTasks();
      } else {
        alert(`触发失败: ${result.error}`);
      }
    } catch (err) {
      console.error("Trigger task error:", err);
      alert(`触发失败: ${err instanceof Error ? err.message : "未知错误"}`);
    }
  }, [loadSchedulerTasks]);

  // 切换任务状态
  const toggleTask = useCallback(async (taskId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/scheduler/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadSchedulerTasks();
      } else {
        alert(`操作失败: ${result.error}`);
      }
    } catch (err) {
      console.error("Toggle task error:", err);
    }
  }, [loadSchedulerTasks]);

  // 删除任务
  const deleteTask = useCallback(async (taskId: string) => {
    if (!confirm("确定要删除这个定时任务吗？")) return;
    
    try {
      const response = await fetch(`/api/scheduler/${taskId}`, {
        method: "DELETE",
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadSchedulerTasks();
      } else {
        alert(`删除失败: ${result.error}`);
      }
    } catch (err) {
      console.error("Delete task error:", err);
    }
  }, [loadSchedulerTasks]);

  // 处理 PDF 上传
  const handlePDFUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      alert('请上传 PDF 格式的文件');
      return;
    }
    
    if (!cozeToken) {
      alert('请先配置 Coze 访问令牌');
      return;
    }
    
    setIsUploadingPDF(true);
    setPdfFileName(file.name);
    
    try {
      // 创建 FormData 上传文件
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cozeToken', cozeToken);
      
      // 调用 PDF 分析 API
      const response = await fetch('/api/pdf-analysis', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        setArticleReport(result.report);
        setArticleAnalysisLog(['PDF 分析完成']);
      } else {
        throw new Error(result.error || '分析失败');
      }
    } catch (error) {
      console.error('PDF 上传分析失败:', error);
      setArticleAnalysisLog([`错误: ${error instanceof Error ? error.message : '分析失败'}`]);
    } finally {
      setIsUploadingPDF(false);
      // 清空 input 以便重新上传同一文件
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
    }
  }, [cozeToken]);

  // 加载 RSS 文章
  const loadRSSFeed = useCallback(async () => {
    if (!rssUrl) return;
    
    setIsLoadingRSS(true);
    setRssError(null);
    
    try {
      const response = await fetch(`/api/rss?url=${encodeURIComponent(rssUrl)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setRssFeed(result.data);
      } else {
        setRssError(result.error || "加载 RSS 失败");
      }
    } catch (err) {
      console.error("Failed to load RSS:", err);
      setRssError(err instanceof Error ? err.message : "加载 RSS 失败");
    } finally {
      setIsLoadingRSS(false);
    }
  }, [rssUrl]);

  // 单篇文章分析
  const analyzeArticle = useCallback(async (article: RSSItem) => {
    if (!cozeToken) {
      alert("请先配置 Coze 访问令牌");
      return;
    }
    
    if (holdings.length === 0) {
      alert("请至少添加一个持仓股票");
      return;
    }
    
    setAnalyzingArticle(article);
    setArticleAnalysisLog([]);
    setArticleReport(null);
    
    const addArticleLog = (message: string, type: "info" | "success" | "error" = "info") => {
      const timestamp = new Date().toLocaleTimeString("zh-CN");
      const prefix = type === "success" ? "✅" : type === "error" ? "❌" : "📋";
      setArticleAnalysisLog(prev => [...prev, `[${timestamp}] ${prefix} ${message}`]);
    };
    
    addArticleLog(`开始分析: ${article.title}`);
    
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cozeToken,
          article: {
            title: article.title,
            link: article.link,
            description: article.description,
            content: article.content,
          },
          holdings: holdings.map(h => h.code),
        }),
      });
      
      if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
        const errorData = await response.json().catch(() => ({ error: "未知错误" }));
        addArticleLog(`错误: ${errorData.error}`, "error");
        return;
      }
      
      addArticleLog("已连接到工作流...");
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应流");
      }
      
      const decoder = new TextDecoder();
      let buffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          addArticleLog("分析完成", "success");
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        
        for (const event of events) {
          if (!event.trim() || !event.startsWith("data: ")) continue;
          
          try {
            const jsonStr = event.substring(6);
            const data = JSON.parse(jsonStr);
            
            switch (data.type) {
              case "connected":
                addArticleLog("已连接到工作流服务");
                break;
              case "workflow_start":
                addArticleLog(`工作流启动 (ID: ${data.run_id?.slice(0, 8)}...)`);
                break;
              case "workflow_end":
                if (data.output?.final_report) {
                  setArticleReport(data.output.final_report);
                  addArticleLog("已生成分析报告", "success");
                }
                break;
              case "error":
                addArticleLog(`错误: ${data.error || data.message}`, "error");
                break;
              default:
                if (data.type !== "ping") {
                  addArticleLog(`事件: ${data.type}`);
                }
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      addArticleLog(`分析失败: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setAnalyzingArticle(null);
    }
  }, [cozeToken, holdings]);

  // 自动滚动日志
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [executionLog]);

  // 添加日志
  const addLog = useCallback((message: string, type: "info" | "success" | "error" = "info") => {
    const timestamp = new Date().toLocaleTimeString("zh-CN");
    const prefix = type === "success" ? "✅" : type === "error" ? "❌" : "📋";
    setExecutionLog(prev => [...prev, `[${timestamp}] ${prefix} ${message}`]);
  }, []);

  // 保存配置
  const saveConfig = useCallback(() => {
    localStorage.setItem("cozeToken", cozeToken);
    localStorage.setItem("rssUrl", rssUrl);
    setShowConfigDialog(false);
  }, [cozeToken, rssUrl]);

  // 保存钉钉配置
  const saveDingtalkConfig = useCallback(() => {
    localStorage.setItem("dingtalkWebhook", dingtalkWebhook);
    localStorage.setItem("dingtalkSecret", dingtalkSecret);
    setShowDingtalkDialog(false);
  }, [dingtalkWebhook, dingtalkSecret]);

  // 添加持仓
  const addHolding = useCallback(async () => {
    if (!newHoldingCode.trim()) return;
    
    const code = newHoldingCode.trim().toUpperCase();
    const name = newHoldingName.trim() || newHoldingCode.trim();

    try {
      // 添加持仓
      const response = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name }),
      });
      const result = await response.json();
      
      if (result.success) {
        setHoldings(prev => [...prev, result.data]);
        setNewHoldingCode("");
        setNewHoldingName("");
        
        // 自动同步股票数据
        fetch('/api/stock/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, days: 365 }),
        }).then(syncRes => syncRes.json())
          .then(syncResult => {
            if (syncResult.success) {
              console.log(`Stock data synced: ${syncResult.data.count} records`);
            }
          })
          .catch(err => console.error('Stock sync error:', err));
      } else {
        console.error("Failed to add holding:", result.error);
      }
    } catch (err) {
      console.error("Failed to add holding:", err);
    }
  }, [newHoldingCode, newHoldingName]);

  // 删除持仓
  const removeHolding = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/holdings/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      
      if (result.success) {
        setHoldings(prev => prev.filter(h => h.id !== id));
      } else {
        console.error("Failed to remove holding:", result.error);
      }
    } catch (err) {
      console.error("Failed to remove holding:", err);
    }
  }, []);

  // 执行工作流
  const executeWorkflow = useCallback(async () => {
    if (!cozeToken) {
      setStatus("error");
      setStatusMessage("请先配置 Coze 访问令牌");
      setErrorCode("MISSING_TOKEN");
      return;
    }
    
    if (holdings.length === 0) {
      setStatus("error");
      setStatusMessage("请至少添加一个持仓股票");
      setErrorCode("MISSING_HOLDINGS");
      return;
    }
    
    // 重置状态
    setStatus("connecting");
    setStatusMessage("正在连接工作流...");
    setErrorCode(null);
    setFinalReport(null);
    setExecutionLog([]);
    setRunId(null);
    
    addLog("开始执行工作流");
    addLog(`RSS 地址: ${rssUrl}`);
    addLog(`持仓股票: ${holdings.map(h => h.code).join(", ")}`);
    
    try {
      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cozeToken,
          rssUrl,
          holdings: holdings.map(h => h.code),
        }),
      });
      
      // 处理非流式错误响应
      if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) {
        const errorData = await response.json().catch(() => ({ error: "未知错误" }));
        setStatus("error");
        setStatusMessage(errorData.error || `请求失败 (${response.status})`);
        setErrorCode(errorData.code || "REQUEST_ERROR");
        addLog(`错误: ${errorData.error}`, "error");
        if (errorData.details) {
          addLog(`详情: ${errorData.details}`, "error");
        }
        return;
      }
      
      setStatus("running");
      setStatusMessage("工作流运行中...");
      addLog("已连接，等待处理...");
      
      // 处理 SSE 流
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应流");
      }
      
      const decoder = new TextDecoder();
      let buffer = "";
      let eventCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          addLog("数据流结束");
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        
        for (const event of events) {
          if (!event.trim() || !event.startsWith("data: ")) continue;
          
          try {
            const jsonStr = event.substring(6);
            const data: WorkflowEvent = JSON.parse(jsonStr);
            eventCount++;
            
            // 处理不同类型的事件
            switch (data.type) {
              case "connected":
                addLog("已连接到工作流服务");
                break;
                
              case "workflow_start":
                setStatus("running");
                setStatusMessage("工作流已启动");
                setRunId(data.run_id || null);
                addLog(`工作流启动 (ID: ${data.run_id?.slice(0, 8)}...)`);
                break;
                
              case "ping":
                addLog("心跳检测 - 工作流运行中");
                break;
                
              case "workflow_end":
                addLog("工作流执行完成", "success");
                if (data.output?.final_report) {
                  setFinalReport(data.output.final_report);
                  addLog("已生成分析报告", "success");
                }
                setStatus("success");
                setStatusMessage("分析完成");
                break;
                
              case "error":
                setStatus("error");
                setStatusMessage(data.error || data.message || "未知错误");
                setErrorCode(data.code || "WORKFLOW_ERROR");
                addLog(`错误: ${data.error || data.message}`, "error");
                break;
                
              case "stream_end":
                addLog(`数据流结束，共 ${data.total_events || eventCount} 个事件`);
                if (status !== "success" && status !== "error") {
                  setStatus("success");
                  setStatusMessage("处理完成");
                }
                break;
                
              default:
                addLog(`事件: ${data.type}`);
            }
          } catch (parseError) {
            console.error("Parse error:", parseError);
          }
        }
      }
      
      // 如果结束时还没有收到 workflow_end
      if (status === "running") {
        setStatus("success");
        setStatusMessage("处理完成（未收到完成信号）");
      }
      
    } catch (err) {
      console.error("Execute error:", err);
      setStatus("error");
      setStatusMessage(err instanceof Error ? err.message : "工作流执行失败");
      setErrorCode("EXECUTION_ERROR");
      addLog(`执行失败: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }, [cozeToken, rssUrl, holdings, addLog, status]);

  // 推送钉钉
  const pushToDingtalk = useCallback(async () => {
    if (!dingtalkWebhook || !dingtalkSecret) {
      alert("请先配置钉钉 Webhook 和密钥");
      return;
    }
    
    if (!finalReport) {
      alert("没有分析报告可推送");
      return;
    }
    
    try {
      const response = await fetch("/api/dingtalk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook: dingtalkWebhook,
          secret: dingtalkSecret,
          title: "财经早报分析报告",
          content: finalReport,
          articleDate: new Date().toLocaleDateString("zh-CN"),
          articleUrl: rssUrl,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert("✅ 已成功推送至钉钉");
      } else {
        alert(`推送失败: ${result.error || "未知错误"}`);
      }
    } catch (err) {
      alert(`推送失败: ${err instanceof Error ? err.message : "未知错误"}`);
    }
  }, [dingtalkWebhook, dingtalkSecret, finalReport, rssUrl]);

  // 重置状态
  const resetExecution = useCallback(() => {
    setStatus("idle");
    setStatusMessage("");
    setErrorCode(null);
    setExecutionLog([]);
  }, []);

  // 检查配置状态
  const isConfigured = cozeToken && holdings.length > 0;
  const isDingtalkConfigured = dingtalkWebhook && dingtalkSecret;

  // 状态颜色和图标
  const getStatusDisplay = () => {
    switch (status) {
      case "connecting":
        return { icon: <Wifi className="h-4 w-4 animate-pulse text-blue-500" />, text: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" };
      case "running":
        return { icon: <Loader2 className="h-4 w-4 animate-spin text-primary" />, text: "text-primary", bg: "bg-primary/5" };
      case "success":
        return { icon: <CheckCircle className="h-4 w-4 text-green-500" />, text: "text-green-500", bg: "bg-green-50 dark:bg-green-950/30" };
      case "error":
        return { icon: <AlertCircle className="h-4 w-4 text-destructive" />, text: "text-destructive", bg: "bg-destructive/5" };
      default:
        return { icon: <Clock className="h-4 w-4 text-muted-foreground" />, text: "text-muted-foreground", bg: "bg-muted/30" };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      {/* 顶部导航 */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
            <h1 className="text-base sm:text-xl font-bold truncate">财经早报分析系统</h1>
            <Badge variant={isConfigured ? "default" : "secondary"} className="text-xs hidden sm:inline-flex">
              {isConfigured ? "已配置" : "未配置"}
            </Badge>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* 系统配置 */}
            <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 sm:h-9">
                  <Settings className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">系统配置</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>系统配置</DialogTitle>
                  <DialogDescription>
                    配置 Coze 访问令牌和 RSS 订阅地址
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="cozeToken" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Coze 访问令牌 *
                    </Label>
                    <Textarea
                      id="cozeToken"
                      placeholder="粘贴你的 Coze API Token..."
                      className="min-h-[80px] max-h-[120px] font-mono text-xs break-all overflow-x-hidden resize-none"
                      value={cozeToken}
                      onChange={(e) => setCozeToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      从 Coze 平台获取的访问令牌
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rssUrl" className="flex items-center gap-2">
                      <Rss className="h-4 w-4" />
                      RSS 订阅地址
                    </Label>
                    <Input
                      id="rssUrl"
                      placeholder="https://wechat2rss.marlinworks.xyz/feed/xxx.xml"
                      value={rssUrl}
                      onChange={(e) => setRssUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      默认为路透财经早报的 RSS 源
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
                    取消
                  </Button>
                  <Button onClick={saveConfig}>
                    保存配置
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* 钉钉配置 */}
            <Dialog open={showDingtalkDialog} onOpenChange={setShowDingtalkDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 sm:h-9">
                  <Bell className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">钉钉配置</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>钉钉推送配置</DialogTitle>
                  <DialogDescription>
                    配置钉钉机器人 Webhook 和加签密钥
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook">Webhook 地址 *</Label>
                    <Input
                      id="webhook"
                      placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx"
                      value={dingtalkWebhook}
                      onChange={(e) => setDingtalkWebhook(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secret">加签密钥 *</Label>
                    <Input
                      id="secret"
                      type="password"
                      placeholder="SECxxxx..."
                      value={dingtalkSecret}
                      onChange={(e) => setDingtalkSecret(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      在钉钉机器人设置中开启"加签"获取
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDingtalkDialog(false)}>
                    取消
                  </Button>
                  <Button onClick={saveDingtalkConfig}>
                    保存配置
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* 定时器配置 */}
            <Dialog open={showSchedulerDialog} onOpenChange={setShowSchedulerDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => loadSchedulerTasks()}
                >
                  <Timer className="h-4 w-4 mr-2" />
                  定时任务
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Timer className="h-5 w-5" />
                    定时任务管理
                  </DialogTitle>
                  <DialogDescription>
                    创建定时任务，支持每日循环或一次性执行
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                  {/* 创建新任务 */}
                  <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                    <h4 className="font-medium text-sm">创建定时任务</h4>
                    
                    {/* 任务类型选择 */}
                    <div className="space-y-2">
                      <Label className="text-xs">任务类型</Label>
                      <div className="flex gap-2">
                        {availableTaskTypes.map((type) => (
                          <Button
                            key={type.type}
                            variant={newTaskType === type.type ? "default" : "outline"}
                            size="sm"
                            onClick={() => setNewTaskType(type.type)}
                            className="flex-1"
                          >
                            {type.name}
                          </Button>
                        ))}
                      </div>
                      {availableTaskTypes.find(t => t.type === newTaskType)?.description && (
                        <p className="text-xs text-muted-foreground">
                          {availableTaskTypes.find(t => t.type === newTaskType)?.description}
                        </p>
                      )}
                    </div>
                    
                    {/* 任务模式选择 */}
                    <div className="space-y-2">
                      <Label className="text-xs">执行模式</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={newTaskMode === 'daily' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewTaskMode('daily')}
                          className="flex-1"
                        >
                          每日循环
                        </Button>
                        <Button
                          variant={newTaskMode === 'once' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewTaskMode('once')}
                          className="flex-1"
                        >
                          一次性
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {newTaskMode === 'daily' 
                          ? '每天在指定时间自动执行' 
                          : '在指定时间执行一次后自动删除'}
                      </p>
                    </div>
                    
                    {/* 执行时间选择 */}
                    <div className="space-y-2">
                      {newTaskMode === 'once' && (
                        <div className="space-y-2">
                          <Label className="text-xs">执行日期</Label>
                          <Input
                            type="date"
                            value={newTaskDate}
                            onChange={(e) => setNewTaskDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      )}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-2">
                          <Label className="text-xs">
                            {newTaskMode === 'daily' ? '执行时间（北京时间，每日）' : '执行时间（北京时间）'}
                          </Label>
                          <Input
                            type="time"
                            value={newTaskTime}
                            onChange={(e) => setNewTaskTime(e.target.value)}
                          />
                        </div>
                        <Button 
                          onClick={createTask}
                          disabled={isCreatingTask || !isConfigured || (newTaskMode === 'once' && !newTaskDate)}
                          className="h-10"
                        >
                          {isCreatingTask ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Plus className="h-4 w-4 mr-2" />
                          )}
                          创建任务
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* 任务列表 */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">当前任务</h4>
                    {isLoadingScheduler ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : cronJobs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        暂无定时任务，请创建新任务
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cronJobs.map((job) => (
                          <div 
                            key={job.id} 
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{job.name}</span>
                                <Badge variant={job.taskMode === 'once' ? 'secondary' : 'default'} className="text-xs">
                                  {job.taskMode === 'once' ? '一次性' : '每日'}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {availableTaskTypes.find(t => t.type === job.taskType)?.name || job.taskType}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {job.taskMode === 'daily' && job.cronExpr && (
                                  <span>Cron: {job.cronExpr}</span>
                                )}
                                {job.taskMode === 'once' && job.runAt && (
                                  <span>执行时间: {new Date(job.runAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
                                )}
                                {job.nextRunAt && (
                                  <span className="ml-2">
                                    下次运行: {new Date(job.nextRunAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                                  </span>
                                )}
                              </div>
                              {job.lastResult && (
                                <div className="text-xs text-muted-foreground mt-1 truncate">
                                  上次结果: {job.lastResult}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => triggerTask(job.id)}
                                disabled={!job.enabled}
                                className="h-7 text-xs"
                              >
                                <Play className="h-3 w-3 mr-1" />
                                执行
                              </Button>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={job.enabled}
                                onClick={() => toggleTask(job.id, !job.enabled)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                  job.enabled ? 'bg-primary' : 'bg-muted'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                                    job.enabled ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className="text-xs text-muted-foreground">
                                {job.enabled ? '已启用' : '已禁用'}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteTask(job.id)}
                                className="h-7 w-7"
                              >
                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* 执行日志 */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">执行日志（最近 20 条）</h4>
                    {jobLogs.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        暂无执行日志
                      </div>
                    ) : (
                      <div className="max-h-[300px] overflow-y-auto space-y-1">
                        {jobLogs.slice(0, 20).map((log) => (
                          <div 
                            key={log.id}
                            className={`text-xs p-2 rounded ${
                              log.status === 'success' ? 'bg-green-50 dark:bg-green-950/30' :
                              log.status === 'failed' ? 'bg-red-50 dark:bg-red-950/30' :
                              log.status === 'running' ? 'bg-blue-50 dark:bg-blue-950/30' :
                              'bg-muted/30'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{log.jobName}</span>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                {log.triggerSource === 'manual' && (
                                  <Badge variant="outline" className="text-[10px] h-4">手动</Badge>
                                )}
                                <span>
                                  {log.startedAt ? new Date(log.startedAt).toLocaleString('zh-CN') : '待执行'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-muted-foreground">
                                {log.status === 'success' ? '✅ ' : 
                                 log.status === 'failed' ? '❌ ' : 
                                 log.status === 'running' ? '⏳ ' : '⏸️ '}
                                {log.result || log.error || 
                                 (log.status === 'running' ? '执行中...' : '等待执行')}
                              </span>
                              {log.duration && (
                                <span className="text-muted-foreground">
                                  耗时: {(log.duration / 1000).toFixed(1)}s
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowSchedulerDialog(false)}>
                    关闭
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container px-2 sm:px-4 py-4 sm:py-6 max-w-7xl">
        <Tabs defaultValue="dashboard" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-10 sm:h-11">
            <TabsTrigger value="articles" className="text-xs sm:text-sm px-2 sm:px-4">📰 <span className="hidden sm:inline">消息面分析</span><span className="sm:hidden">消息面</span></TabsTrigger>
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm px-2 sm:px-4">📊 <span className="hidden sm:inline">分析面板</span><span className="sm:hidden">面板</span></TabsTrigger>
            <TabsTrigger value="result" disabled={!finalReport} className="text-xs sm:text-sm px-2 sm:px-4">
              📄 <span className="hidden sm:inline">分析报告</span><span className="sm:hidden">报告</span>
            </TabsTrigger>
          </TabsList>

          {/* RSS 文章列表 */}
          <TabsContent value="articles" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Newspaper className="h-4 w-4 sm:h-5 sm:w-5" />
                      消息面分析
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm mt-1">
                      上传 PDF 文件或 RSS 订阅获取市场资讯
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={loadRSSFeed} 
                    disabled={isLoadingRSS || !rssUrl}
                    variant="outline"
                    size="sm"
                    className="h-8 sm:h-9"
                  >
                    {isLoadingRSS ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        加载中...
                      </>
                    ) : (
                      <>
                        <Rss className="mr-2 h-4 w-4" />
                        刷新文章
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                {/* PDF 上传分析区域 */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Upload className="h-4 w-4 text-primary" />
                    <h3 className="font-medium text-sm">PDF 文件分析</h3>
                  </div>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handlePDFUpload}
                      ref={pdfInputRef}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="h-10 w-10 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        点击或拖拽上传 PDF 文件进行消息面分析
                      </div>
                      <Button
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={isUploadingPDF || !isConfigured}
                        variant="outline"
                        className="mt-2"
                      >
                        {isUploadingPDF ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            分析中...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            选择 PDF 文件
                          </>
                        )}
                      </Button>
                      {pdfFileName && (
                        <div className="text-sm text-muted-foreground mt-2">
                          当前文件: {pdfFileName}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* 分隔线 */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">或使用 RSS 订阅</span>
                  </div>
                </div>
                
                {rssError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>加载失败</AlertTitle>
                    <AlertDescription>{rssError}</AlertDescription>
                  </Alert>
                )}
                
                {isLoadingRSS && !rssFeed && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">正在加载 RSS 内容...</span>
                  </div>
                )}
                
                {!isLoadingRSS && !rssFeed && !rssError && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">点击"刷新文章"加载 RSS 内容</p>
                    <Button onClick={loadRSSFeed} variant="outline">
                      <Rss className="mr-2 h-4 w-4" />
                      加载文章
                    </Button>
                  </div>
                )}
                
                {rssFeed && rssFeed.items.length > 0 && (
                  <div className="space-y-3">
                    {rssFeed.items.map((item, index) => (
                      <div 
                        key={index} 
                        className="p-3 sm:p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm mb-1 sm:mb-2 line-clamp-2">
                              {item.title}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {item.description || "无描述"}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {item.pubDate && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(item.pubDate).toLocaleDateString("zh-CN")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0 mt-2 sm:mt-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => window.open(item.link, "_blank")}
                            >
                              <ExternalLink className="h-3 w-3 sm:mr-1" />
                              <span className="hidden sm:inline">查看</span>
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => analyzeArticle(item)}
                              disabled={analyzingArticle !== null || !isConfigured}
                            >
                              {analyzingArticle?.link === item.link ? (
                                <>
                                  <Loader2 className="h-3 w-3 sm:mr-1 animate-spin" />
                                  <span className="hidden sm:inline">分析中</span>
                                </>
                              ) : (
                                <>
                                  <Search className="h-3 w-3 sm:mr-1" />
                                  分析
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* 单篇分析结果 */}
            {(articleAnalysisLog.length > 0 || articleReport) && (
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">单篇分析结果</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    分析当前选中的文章
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                  {articleAnalysisLog.length > 0 && (
                    <div className="p-3 rounded-lg bg-muted/30 max-h-[200px] overflow-y-auto">
                      <div className="text-xs font-mono space-y-1">
                        {articleAnalysisLog.map((log, index) => (
                          <div key={index} className="text-muted-foreground whitespace-pre-wrap">
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {articleReport && (
                    <div className="mt-4">
                      <h4 className="font-medium text-sm mb-2">分析报告</h4>
                      <ScrollArea className="h-[400px]">
                        <div className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg border font-mono">
                          {articleReport}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 分析面板 */}
          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
              {/* 左侧：持仓管理 + 执行 */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                {/* 持仓配置 */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base sm:text-lg">持仓股票</CardTitle>
                        <CardDescription className="text-xs sm:text-sm mt-1">
                          添加需要分析的股票代码
                        </CardDescription>
                      </div>
                      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-xs">
                            <Plus className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">批量导入</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>批量导入股票代码</DialogTitle>
                            <DialogDescription>
                              粘贴股票代码列表，每行一个
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>股票列表</Label>
                              <Textarea
                                placeholder={`支持格式：
002050 三花智控
00981 中芯国际
002594 比亚迪

或使用逗号分隔：
002050,三花智控
00981,中芯国际`}
                                className="min-h-[150px] sm:min-h-[200px] font-mono text-xs sm:text-sm"
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                              />
                              <p className="text-xs text-muted-foreground">
                                每行一个股票，格式：代码 名称（空格分隔）或 代码,名称
                              </p>
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                              <div className="font-medium mb-1">解析预览：</div>
                              {importText.trim() ? (
                                <div className="space-y-1">
                                  {parseImportText(importText).slice(0, 5).map((s, i) => (
                                    <div key={i}>{s.code} - {s.name}</div>
                                  ))}
                                  {parseImportText(importText).length > 5 && (
                                    <div>... 共 {parseImportText(importText).length} 只</div>
                                  )}
                                </div>
                              ) : (
                                <div>等待输入...</div>
                              )}
                            </div>
                          </div>
                          <DialogFooter className="flex-col sm:flex-row gap-2">
                            <Button variant="outline" onClick={() => setShowImportDialog(false)} className="w-full sm:w-auto">
                              取消
                            </Button>
                            <Button 
                              onClick={handleImportStocks}
                              disabled={!importText.trim() || isImporting}
                              className="w-full sm:w-auto"
                            >
                              {isImporting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  导入中...
                                </>
                              ) : (
                                <>
                                  <Plus className="mr-2 h-4 w-4" />
                                  确认导入
                                </>
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                    {/* 持仓列表 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {holdings.map((holding) => (
                        <div
                          key={holding.id}
                          className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border bg-muted/30"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-sm font-medium truncate">{holding.code}</div>
                            <div className="text-xs text-muted-foreground truncate">{holding.name}</div>
                          </div>
                          <div className="flex items-center gap-0.5 sm:gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => router.push(`/stock/${holding.code}`)}
                              title="查看K线图"
                            >
                              <BarChart2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => router.push(`/stock/${holding.code}/analysis`)}
                              title="三位一体技术分析"
                            >
                              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground hover:text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8"
                              onClick={() => removeHolding(holding.id)}
                              disabled={status === "running" || status === "connecting"}
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* 添加新持仓 */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="股票代码 (如 0700.HK)"
                        value={newHoldingCode}
                        onChange={(e) => setNewHoldingCode(e.target.value.toUpperCase())}
                        className="flex-1 text-sm h-9"
                        disabled={status === "running" || status === "connecting"}
                      />
                      <Input
                        placeholder="名称 (可选)"
                        value={newHoldingName}
                        onChange={(e) => setNewHoldingName(e.target.value)}
                        className="flex-1 text-sm h-9"
                        disabled={status === "running" || status === "connecting"}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addHolding}
                        disabled={!newHoldingCode.trim() || status === "running" || status === "connecting"}
                        className="h-9 w-full sm:w-auto"
                      >
                        <Plus className="h-4 w-4 sm:mr-2" />
                        <span className="sm:inline">添加</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 执行控制 */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">执行分析</CardTitle>
                    <CardDescription className="text-xs sm:text-sm mt-1">
                      一键调用工作流分析早报和持仓影响
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                    {/* 执行状态 */}
                    <div className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg ${statusDisplay.bg}`}>
                      {statusDisplay.icon}
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium text-sm sm:text-base ${statusDisplay.text}`}>
                          {statusMessage || "等待执行"}
                        </div>
                        {runId && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            Run ID: {runId}
                          </div>
                        )}
                        {errorCode && (
                          <div className="text-xs text-destructive mt-1">
                            错误码: {errorCode}
                          </div>
                        )}
                      </div>
                      {(status === "success" || status === "error") && (
                        <Button variant="ghost" size="sm" onClick={resetExecution} className="text-xs h-8">
                          重置
                        </Button>
                      )}
                    </div>

                    {/* 执行日志 */}
                    {executionLog.length > 0 && (
                      <div 
                        ref={logRef}
                        className="p-3 rounded-lg bg-muted/30 max-h-[150px] sm:max-h-[200px] overflow-y-auto"
                      >
                        <div className="text-xs font-mono space-y-1">
                          {executionLog.map((log, index) => (
                            <div key={index} className="text-muted-foreground whitespace-pre-wrap">
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 执行按钮 */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <Button
                        size="lg"
                        onClick={executeWorkflow}
                        disabled={status === "running" || status === "connecting" || !isConfigured}
                        className="flex-1 h-12 text-base font-medium"
                      >
                        {status === "running" || status === "connecting" ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            {status === "connecting" ? "连接中..." : "分析中..."}
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-5 w-5" />
                            一键分析
                          </>
                        )}
                      </Button>
                      {finalReport && isDingtalkConfigured && (
                        <Button
                          size="lg"
                          variant="outline"
                          onClick={pushToDingtalk}
                          className="h-12 text-base font-medium"
                        >
                          <Bell className="mr-2 h-5 w-5" />
                          推送钉钉
                        </Button>
                      )}
                    </div>

                    {/* 配置提示 */}
                    {!isConfigured && (
                      <Alert className="text-xs sm:text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>配置不完整</AlertTitle>
                        <AlertDescription>
                          {!cozeToken && "请先配置 Coze 访问令牌"}
                          {cozeToken && holdings.length === 0 && "请添加至少一个持仓股票"}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 右侧：配置状态 */}
              <div className="space-y-4 sm:space-y-6">
                {/* 配置状态卡片 */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">配置状态</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm flex items-center gap-2">
                        <Key className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Coze 令牌
                      </span>
                      <div className="flex items-center gap-2">
                        {cozeToken && (
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                            {maskToken(cozeToken)}
                          </span>
                        )}
                        <Badge variant={cozeToken ? "default" : "secondary"} className="text-xs">
                          {cozeToken ? "已配置" : "未配置"}
                        </Badge>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm flex items-center gap-2">
                        <Rss className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        RSS 源
                      </span>
                      <Badge variant="default" className="text-xs">已配置</Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        持仓数量
                      </span>
                      <Badge variant="outline" className="text-xs">{holdings.length} 只</Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm flex items-center gap-2">
                        <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        钉钉推送
                      </span>
                      <Badge variant={isDingtalkConfigured ? "default" : "secondary"} className="text-xs">
                        {isDingtalkConfigured ? "已配置" : "未配置"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* 使用说明 */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4 sm:p-6 space-y-3">
                    <h3 className="font-medium text-sm">📖 使用说明</h3>
                    <ol className="text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-2 list-decimal list-inside">
                      <li>配置 Coze 访问令牌</li>
                      <li>添加持仓股票代码</li>
                      <li>点击"一键分析"</li>
                      <li>查看分析报告</li>
                      <li>推送至钉钉群</li>
                    </ol>
                  </CardContent>
                </Card>

                {/* 常用股票代码 */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">常用港股代码</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        onClick={() => {
                          setNewHoldingCode("0700.HK");
                          setNewHoldingName("腾讯控股");
                        }}
                        className="p-2 rounded border hover:bg-muted/50 text-left transition-colors"
                      >
                        <span className="font-mono">0700.HK</span>
                        <span className="block text-muted-foreground">腾讯控股</span>
                      </button>
                      <button
                        onClick={() => {
                          setNewHoldingCode("09988.HK");
                          setNewHoldingName("阿里巴巴-SW");
                        }}
                        className="p-2 rounded border hover:bg-muted/50 text-left transition-colors"
                      >
                        <span className="font-mono">09988.HK</span>
                        <span className="block text-muted-foreground">阿里巴巴</span>
                      </button>
                      <button
                        onClick={() => {
                          setNewHoldingCode("3690.HK");
                          setNewHoldingName("美团-W");
                        }}
                        className="p-2 rounded border hover:bg-muted/50 text-left transition-colors"
                      >
                        <span className="font-mono">3690.HK</span>
                        <span className="block text-muted-foreground">美团</span>
                      </button>
                      <button
                        onClick={() => {
                          setNewHoldingCode("1810.HK");
                          setNewHoldingName("小米集团-W");
                        }}
                        className="p-2 rounded border hover:bg-muted/50 text-left transition-colors"
                      >
                        <span className="font-mono">1810.HK</span>
                        <span className="block text-muted-foreground">小米集团</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* 分析报告 */}
          <TabsContent value="result" className="space-y-4 sm:space-y-6">
            {finalReport && (
              <>
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <CardTitle className="text-base sm:text-lg">财经早报分析报告</CardTitle>
                        <CardDescription className="text-xs sm:text-sm mt-1">
                          生成时间：{new Date().toLocaleString("zh-CN")}
                        </CardDescription>
                      </div>
                      {isDingtalkConfigured && (
                        <Button onClick={pushToDingtalk} size="sm" className="h-9 w-full sm:w-auto">
                          <Bell className="mr-2 h-4 w-4" />
                          推送钉钉
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    <ScrollArea className="h-[400px] sm:h-[600px]">
                      <div className="prose prose-sm max-w-none dark:prose-invert pr-4">
                        <div className="whitespace-pre-wrap text-xs sm:text-sm bg-muted/30 p-4 sm:p-6 rounded-lg border font-mono">
                          {finalReport}
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* 底部状态栏 */}
      <footer className="border-t py-3 sm:py-4 mt-auto">
        <div className="container px-4 flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              工作流驱动
            </Badge>
            <span className="hidden sm:inline">基于 Coze 工作流</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="flex items-center gap-1">
              {status === "running" || status === "connecting" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : status === "success" ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : status === "error" ? (
                <AlertCircle className="h-3 w-3 text-destructive" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">{status === "idle" ? "就绪" : status === "running" ? "运行中" : status === "success" ? "完成" : status === "error" ? "错误" : "连接中"}</span>
            </span>
            <span>持仓: {holdings.length} 只</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
