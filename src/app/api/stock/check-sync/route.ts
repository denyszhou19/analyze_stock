import { NextRequest, NextResponse } from 'next/server';
import { stockDataService, Frequency } from '@/services/stock-data.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 频率映射（前端 -> 内部格式）
const FREQUENCY_MAP: Record<string, string> = {
  '5min': '5',
  '15min': '15',
  '30min': '30',
  '60min': '60',
  '120min': '60',
  'd': 'd',
  'w': 'w',
  'm': 'm',
};

// 所有支持的级别
const ALL_FREQUENCIES: Frequency[] = ['w', 'd', '60', '30', '15', '5'];

/**
 * P2优化：check-sync 改为 data-integrity 的薄封装
 * 
 * 保持接口兼容性，内部复用 data-integrity 的判定逻辑
 */

/**
 * POST /api/stock/check-sync - 检查并同步股票数据
 * 
 * 请求体：
 * - code: 股票代码（必填）
 * - frequencies: 需要检查的周期列表（默认所有级别）
 * - autoSync: 是否自动同步过期数据（默认 true）
 * 
 * 返回：
 * - status: 检查结果
 * - syncResults: 同步结果（如果执行了同步）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      code, 
      frequencies = ALL_FREQUENCIES,
      autoSync = true 
    } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: '请提供股票代码' },
        { status: 400 }
      );
    }

    // 转换频率格式
    const freqs = frequencies.map((f: string) => {
      return (FREQUENCY_MAP[f] || f) as Frequency;
    }).filter((f: Frequency) => ALL_FREQUENCIES.includes(f));

    console.log(`[Stock Check-Sync] 检查 ${code} 的数据新鲜度，级别: ${freqs.join(',')}`);

    // P2优化：调用 data-integrity 接口获取检查结果
    const integrityUrl = new URL('/api/stock/data-integrity', request.url);
    integrityUrl.searchParams.set('code', code);
    
    const integrityRes = await fetch(integrityUrl.toString(), {
      method: 'GET',
      headers: {
        // 内部调用标识
        'x-internal-call': 'true',
      },
    });
    
    const integrityData = await integrityRes.json();
    
    if (!integrityData.success) {
      return NextResponse.json({
        success: false,
        error: integrityData.error || '数据完整性检查失败',
      });
    }

    // 从 data-integrity 结果中提取各级别状态
    const levels: Array<{
      key: string;
      status: string;
      statusText: string;
      lastDate: string | null;
      recordCount: number;
      needsSync: boolean;
      issues: string[];
    }> = integrityData.data.levels || [];
    const levelStatusMap = new Map(levels.map(l => [l.key, l]));
    
    // 构建检查结果（保持原有接口格式）
    const checkResults = freqs.map((freq: Frequency) => {
      const levelStatus = levelStatusMap.get(freq);
      
      if (!levelStatus) {
        return {
          level: freq,
          needsSync: true,
          lastDate: null,
          reason: '无数据记录',
        };
      }
      
      // 使用 data-integrity 的判定结果
      const needsSync = levelStatus.needsSync;
      const lastDate = levelStatus.lastDate;
      
      // 构建原因说明
      let reason = levelStatus.statusText;
      if (needsSync && levelStatus.issues?.length > 0) {
        reason = levelStatus.issues.join('; ');
      }
      
      return {
        level: freq,
        needsSync,
        lastDate,
        reason,
      };
    });

    // 确定需要同步的级别
    const levelsToSync = checkResults.filter((r: { needsSync: boolean; level: Frequency }) => r.needsSync).map((r: { level: Frequency }) => r.level);
    
    // 判断整体状态
    const allFresh = levelsToSync.length === 0;
    
    console.log(`[Stock Check-Sync] 检查结果: ${allFresh ? '全部最新' : `需要同步 ${levelsToSync.join(',')}`}`);
    
    // 如果不需要同步或不需要自动同步，直接返回检查结果
    if (allFresh || !autoSync) {
      return NextResponse.json({
        success: true,
        data: {
          code,
          status: allFresh ? 'fresh' : 'stale',
          canAnalyze: integrityData.data.summary.canAnalyze,
          checkResults,
          needsSync: levelsToSync,
          syncResults: null,
          summary: integrityData.data.summary,
        }
      });
    }

    // 3. 执行同步
    console.log(`[Stock Check-Sync] 开始同步 ${code}，级别: ${levelsToSync.join(',')}`);
    
    const syncResults = await stockDataService.syncStockData(code, levelsToSync as Frequency[]);
    
    console.log(`[Stock Check-Sync] 同步完成: ${syncResults.filter(r => r.success).length}/${syncResults.length} 成功`);
    
    // 4. 同步后再次检查（复检）
    const recheckRes = await fetch(integrityUrl.toString(), {
      method: 'GET',
      headers: { 'x-internal-call': 'true' },
    });
    const recheckData = await recheckRes.json();
    
    const finalCanAnalyze = recheckData.success ? recheckData.data.summary.canAnalyze : false;
    
    return NextResponse.json({
      success: true,
      data: {
        code,
        status: finalCanAnalyze ? 'ready' : 'stale',
        canAnalyze: finalCanAnalyze,
        checkResults,
        needsSync: levelsToSync,
        syncResults: syncResults.map(r => ({
          frequency: r.frequency,
          success: r.success,
          count: r.count,
          newRecords: r.newRecords,
          message: r.message,
        })),
        summary: recheckData.success ? recheckData.data.summary : integrityData.data.summary,
      }
    });

  } catch (err) {
    console.error('[Stock Check-Sync API] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '检查失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stock/check-sync - 快速检查数据状态
 * 
 * 查询参数：
 * - code: 股票代码（必填）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { success: false, error: '请提供股票代码' },
        { status: 400 }
      );
    }

    // P2优化：直接调用 data-integrity 接口
    const integrityUrl = new URL('/api/stock/data-integrity', request.url);
    integrityUrl.searchParams.set('code', code);
    
    const integrityRes = await fetch(integrityUrl.toString());
    const integrityData = await integrityRes.json();
    
    if (!integrityData.success) {
      return NextResponse.json({
        success: false,
        error: integrityData.error || '数据完整性检查失败',
      });
    }

    // 转换为 check-sync 的响应格式
    const { summary, levels } = integrityData.data;
    
    return NextResponse.json({
      success: true,
      data: {
        code,
        status: summary.canAnalyze ? 'ready' : (summary.needsSyncLevels.length > 0 ? 'stale' : 'error'),
        canAnalyze: summary.canAnalyze,
        needsSync: summary.needsSyncLevels,
        summary: {
          okCount: summary.okCount,
          staleCount: summary.staleCount,
          missingCount: summary.missingCount,
          errorCount: summary.errorCount,
        },
        levels: levels.map((l: any) => ({
          frequency: l.key,
          status: l.status,
          lastDate: l.lastDate,
          recordCount: l.recordCount,
          needsSync: l.needsSync,
        })),
      }
    });

  } catch (err) {
    console.error('[Stock Check-Sync API] GET Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '检查失败' },
      { status: 500 }
    );
  }
}
