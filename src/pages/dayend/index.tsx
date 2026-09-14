import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  Lock,
  ReceiptText,
  RefreshCcw,
  ShieldAlert,
  TrendingUp,
  Vault,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReactNode } from "react";
import { getFinancialSummary } from "@/services/financial-api";
import { getDayEndData, performDayEnd } from "@/services/day-end-api";
import { createPortal } from "react-dom";
import { Alert } from "@/components/ui/alert";

export default function Dayend() {
  const today = new Date();
  const defaultDate = today.toISOString().split("T")[0];

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");
  const [prevDayAmount, setPrevDayAmount] = useState(0);
  const [holdNextDayAmount, setHoldNextDayAmount] = useState("");
  const [actualCashCount, setActualCashCount] = useState("");
  const [pageAlert, setPageAlert] = useState<{
    visible: boolean;
    variant?: "success" | "error" | "warning" | "info";
    title?: string;
    description?: string;
  }>({ visible: false });
  const [cashRemark, setCashRemark] = useState("");
  const [financialSummary, setFinancialSummary] = useState({
    totalRevenue: 0,
    cashRevenue: 0,
    creditCardRevenue: 0,
    payPalRevenue: 0,
    totalTransactions: 0,
  });

  const [dayEndData, setDayEndData] = useState<any>(null);
  const [isPageLocked, setIsPageLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const loadSummary = async (date: string) => {
    try {
      const response = await getFinancialSummary(date, date);
      const summary =
        response?.additionalData?.response ??
        response?.response ??
        response ??
        {};

      setFinancialSummary({
        totalRevenue: Number(summary.totalRevenue ?? 0),
        cashRevenue: Number(summary.cashRevenue ?? 0),
        creditCardRevenue: Number(summary.creditCardRevenue ?? 0),
        payPalRevenue: Number(summary.payPalRevenue ?? 0),
        totalTransactions: Number(summary.totalTransactions ?? 0),
      });
    } catch {
      setFinancialSummary({
        totalRevenue: 0,
        cashRevenue: 0,
        creditCardRevenue: 0,
        payPalRevenue: 0,
        totalTransactions: 0,
      });
    }
  };

  const actualCash = actualCashCount
    ? parseFloat(actualCashCount.replace(/[^\d.-]/g, ""))
    : 0;

  const holdAmount = Number(holdNextDayAmount || 0);

  const isHoldAmountValid = holdAmount <= actualCash;

  const discrepancy = financialSummary.cashRevenue + prevDayAmount - actualCash;
  const isDiscrepancyZero = discrepancy === 0;
  const canCloseDay =
    actualCashCount.trim() !== "" &&
    isHoldAmountValid &&
    (isDiscrepancyZero || cashRemark.trim() !== "");

  const handleGetDayendData = async () => {
    try {
      const res = await getDayEndData();

      if (res && res.length > 0) {
        const data = res[0];
        setDayEndData(data);
        loadSummary(data.currentDate.split("T")[0]);
        setPrevDayAmount(Number(data.cashFromPrevDay ?? 0));

        const currentDate = new Date(data.currentDate);
        const today = new Date();

        currentDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        setIsPageLocked(currentDate > today);
      }
    } catch (error: any) {
      console.error("Failed to fetch day end data:", error);
    }
  };

  useEffect(() => {
    handleGetDayendData();
  }, []);

  const formatLkr = (amount: number) =>
    `LKR ${amount.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handlePerformDayEnd = async () => {
    setLoading(true);
    try {
      const body = {
        currentDate: dayEndData.currentDate,
        cashFromPrevDay: prevDayAmount,
        expectedCashTotal: financialSummary.cashRevenue + prevDayAmount,
        actualCashCount: actualCash,
        discrepancy,
        remark: cashRemark,
        holdForNextDay: holdAmount,
      };
      await performDayEnd(body);
      setShowSuccessModal(true);
      handleGetDayendData();
    } catch (error: any) {
      setPageAlert({
        visible: true,
        variant: "error",
        title: "Day End Failed",
        description:
          error.response?.data?.message ||
          "An error occurred while performing day end. Please try again.",
      });
    } finally {
      setLoading(false);
      setShowCloseModal(false);
    }
  };

  const handleContinueToLogin = () => {
    localStorage.removeItem("cashier");
    localStorage.removeItem("dayEndData");
    window.location.href = "/";
  };

  const handleGeneratePdf = () => {
    try {
      setIsExportingPdf(true);

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const primaryColor: [number, number, number] = [30, 58, 138];
      const workingDate = dayEndData?.currentDate || defaultDate;
      const workingDateLabel = new Date(workingDate).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const generatedAt = new Date().toLocaleString("en-GB");

      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 24, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("KVK GYM", 14, 11);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Daily Business Day End & Cash Reconciliation Report", 14, 18);
      doc.text(`Generated: ${generatedAt}`, 196, 18, { align: "right" });

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("REPORT OVERVIEW", 14, 34);
      autoTable(doc, {
        startY: 37,
        theme: "grid",
        head: [["Working Business Date", "Total Transactions", "Total Daily Revenue", "Reconciliation Status"]],
        body: [[
          workingDateLabel,
          `${financialSummary.totalTransactions} orders`,
          formatLkr(financialSummary.totalRevenue),
          isDiscrepancyZero ? "BALANCED" : discrepancy > 0 ? `SHORTAGE: ${formatLkr(discrepancy)}` : `SURPLUS: ${formatLkr(Math.abs(discrepancy))}`,
        ]],
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold", fontSize: 8.5 },
        bodyStyles: { textColor: [30, 41, 59], fontSize: 8.5 },
      });

      const getFinalY = (fallback: number) =>
        (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || fallback;

      const overviewY = getFinalY(55);
      doc.text("1. REVENUE BY PAYMENT METHOD", 14, overviewY + 10);
      autoTable(doc, {
        startY: overviewY + 13,
        theme: "striped",
        head: [["Payment Method", "Amount (LKR)", "Contribution %"]],
        body: [
          ["Cash Payments", formatLkr(financialSummary.cashRevenue), financialSummary.totalRevenue > 0 ? `${Math.round((financialSummary.cashRevenue / financialSummary.totalRevenue) * 100)}%` : "0%"],
          ["Credit / Debit Card", formatLkr(financialSummary.creditCardRevenue), financialSummary.totalRevenue > 0 ? `${Math.round((financialSummary.creditCardRevenue / financialSummary.totalRevenue) * 100)}%` : "0%"],
          ["Online Payments", formatLkr(financialSummary.payPalRevenue), financialSummary.totalRevenue > 0 ? `${Math.round((financialSummary.payPalRevenue / financialSummary.totalRevenue) * 100)}%` : "0%"],
          ["TOTAL REVENUE", formatLkr(financialSummary.totalRevenue), "100%"],
        ],
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
        footStyles: { fontStyle: "bold" },
      });

      const revenueY = getFinalY(110);
      doc.text("2. CASH DRAWER RECONCILIATION BREAKDOWN", 14, revenueY + 10);
      autoTable(doc, {
        startY: revenueY + 13,
        theme: "grid",
        head: [["Reconciliation Item", "Amount (LKR)", "Audit Description"]],
        body: [
          ["Opening Cash (From Previous Day)", formatLkr(prevDayAmount), "Carried forward opening drawer float"],
          ["Today's Cash Sales Revenue", formatLkr(financialSummary.cashRevenue), "Total physical cash received today"],
          ["Total Expected Cash in Drawer", formatLkr(financialSummary.cashRevenue + prevDayAmount), "Opening Float + Today's Cash Sales"],
          ["Actual Physical Cash Counted", formatLkr(actualCash), "Verified drawer count entered by cashier"],
          ["Reconciliation Discrepancy", formatLkr(Math.abs(discrepancy)), isDiscrepancyZero ? "Matched perfectly (0.00)" : discrepancy > 0 ? "CASH SHORTAGE" : "CASH SURPLUS"],
        ],
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold", fontSize: 8.5 },
      });

      const reconciliationY = getFinalY(170);
      doc.text("3. CASH SETTLEMENT & SAFE DEPOSIT", 14, reconciliationY + 10);
      autoTable(doc, {
        startY: reconciliationY + 13,
        theme: "grid",
        head: [["Settlement Detail", "Amount (LKR)", "Action"]],
        body: [
          ["Physical Cash in Register", formatLkr(actualCash), "Total counted cash"],
          ["Hold Float for Next Day", formatLkr(holdAmount), "Remains in register for tomorrow"],
          ["Net Cash to Bank / Safe Deposit", formatLkr(Math.max(0, actualCash - holdAmount)), "To be securely deposited"],
        ],
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
      });

      const settlementY = getFinalY(220);
      const notes = [cashRemark ? `Reason: ${cashRemark}` : "", closingNotes ? `Notes: ${closingNotes}` : ""].filter(Boolean).join(" | ");
      let signY = settlementY + 20;
      if (notes) {
        doc.text("DISCREPANCY REMARKS & OPERATIONAL NOTES:", 14, settlementY + 10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(doc.splitTextToSize(notes, 180), 14, settlementY + 15);
        signY += 10;
      }
      signY = Math.min(270, signY);
      doc.setDrawColor(203, 213, 225);
      doc.line(14, signY, 70, signY);
      doc.line(140, signY, 196, signY);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Prepared By (Cashier Signature)", 14, signY + 5);
      doc.text("Verified By (Manager / Owner)", 140, signY + 5);

      doc.save(`KVK_DayEnd_Report_${workingDate.split("T")[0]}.pdf`);
      setPageAlert({ visible: true, variant: "success", title: "Report Downloaded", description: "Day end reconciliation PDF report has been generated successfully." });
    } catch (error) {
      console.error("PDF generation failed:", error);
      setPageAlert({ visible: true, variant: "error", title: "PDF Export Failed", description: "Unable to generate the PDF report. Please try again." });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50/60">
      {pageAlert.visible && (
        <div className="fixed right-4 top-4 z-[99999] w-[calc(100%-2rem)] max-w-md">
          <Alert
            variant={pageAlert.variant as any}
            title={pageAlert.title}
            description={pageAlert.description}
            onClose={() => setPageAlert((s) => ({ ...s, visible: false }))}
          />
        </div>
      )}
      {(loading || isExportingPdf) && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            <p className="text-sm font-medium text-white">{loading ? "Finalizing Day End..." : "Generating PDF Report..."}</p>
          </div>
        </div>,
        document.body,
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
              <ReceiptText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Day End Reconciliation</h1>
                {dayEndData?.currentDate && (
                  <span className="hidden items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 sm:inline-flex">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
                    {new Date(dayEndData.currentDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">Reconcile cash drawer balances, verify daily revenue, and finalize the business day.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={() => window.location.reload()} className="inline-flex cursor-pointer h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700">
              <RefreshCcw size={16} /> Refresh
            </button>
            <button type="button" onClick={handleGeneratePdf} disabled={loading || isExportingPdf} className="inline-flex cursor-pointer h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60">
              <Download size={16} /> Print Report
            </button>
            {!isPageLocked && (
              <button type="button" onClick={() => setShowCloseModal(true)} disabled={!canCloseDay || loading} className="inline-flex cursor-pointer h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                <Lock size={16} /> Close Business Day
              </button>
            )}
          </div>
        </div>

        {isPageLocked && <div className="mb-6 flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm sm:p-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Lock size={20} /></div><div><h3 className="font-bold text-amber-900">Day End Not Available (Future Working Date)</h3><p className="mt-1 text-sm text-amber-800">The current business working date is set to a future date. Day end closing is locked until that working date arrives.</p></div></div>}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total Revenue" value={formatLkr(financialSummary.totalRevenue)} subtitle="Combined daily income" icon={<TrendingUp size={20} />} iconClassName="bg-blue-50 text-blue-600" />
          <SummaryCard title="Cash Revenue" value={formatLkr(financialSummary.cashRevenue)} subtitle="Cash payments today" icon={<Banknote size={20} />} iconClassName="bg-amber-50 text-amber-600" />
          <SummaryCard title="Card Revenue" value={formatLkr(financialSummary.creditCardRevenue)} subtitle="Debit & credit cards" icon={<CreditCard size={20} />} iconClassName="bg-violet-50 text-violet-600" />
          <SummaryCard title="Online Revenue" value={formatLkr(financialSummary.payPalRevenue)} subtitle="Online payments today" icon={<ReceiptText size={20} />} iconClassName="bg-emerald-50 text-emerald-600" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-7">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 p-4 sm:px-6"><div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><Banknote size={19} /></div><div><h2 className="font-bold text-slate-900">Cash Drawer Reconciliation</h2><p className="text-xs text-slate-500">Verify physical cash against system recorded transactions</p></div></div><StatusBadge entered={actualCashCount.trim() !== ""} balanced={isDiscrepancyZero} shortage={discrepancy > 0} /></div>
            <div className="flex-1 space-y-6 p-5 sm:p-6"><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><BreakdownCard label="Opening Cash" value={formatLkr(prevDayAmount)} subtext="From previous day" /><BreakdownCard label="Cash Sales" value={formatLkr(financialSummary.cashRevenue)} subtext="Today's cash income" /><BreakdownCard label="Expected in Drawer" value={formatLkr(financialSummary.cashRevenue + prevDayAmount)} subtext="Opening + Cash Sales" highlight /></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5"><label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-800"><span>Actual Physical Cash Counted <span className="text-red-500">*</span></span><span className="text-xs font-normal text-slate-500">Count notes and coins in drawer</span></label><div className="relative mt-2"><span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-bold text-slate-400">LKR</span><input type="number" min="0" step="0.01" value={actualCashCount} onChange={(e) => setActualCashCount(e.target.value)} placeholder="0.00" disabled={isPageLocked} className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-14 pr-4 text-right text-lg font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" /></div></div>
              {actualCashCount.trim() !== "" && <div className={`rounded-2xl border p-4 ${isDiscrepancyZero ? "border-emerald-200 bg-emerald-50/70 text-emerald-900" : discrepancy > 0 ? "border-rose-200 bg-rose-50/70 text-rose-900" : "border-amber-200 bg-amber-50/70 text-amber-900"}`}><div className="flex items-start gap-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/60">{isDiscrepancyZero ? <CheckCircle2 size={18} /> : discrepancy > 0 ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">{isDiscrepancyZero ? "Perfect Match - Drawer is Balanced" : discrepancy > 0 ? "Cash Shortage Detected" : "Cash Surplus Detected"}</p><p className="text-sm font-extrabold">{formatLkr(Math.abs(discrepancy))}</p></div><p className="mt-1 text-xs leading-5 opacity-90">{isDiscrepancyZero ? "The counted cash exactly matches the expected balance. You are ready to close the day." : "A discrepancy reason is required before closing."}</p></div></div></div>}
              {!isDiscrepancyZero && actualCashCount.trim() !== "" && <div className="space-y-1.5"><label className="text-sm font-semibold text-slate-800">Discrepancy Reason / Remark <span className="text-red-500">*</span></label><textarea rows={3} value={cashRemark} onChange={(e) => setCashRemark(e.target.value)} placeholder="Provide an explanation for the cash shortage or surplus..." disabled={isPageLocked} className="w-full resize-none rounded-xl border border-rose-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100" />{!cashRemark.trim() && <p className="text-xs font-medium text-rose-600">Please enter the reason for the cash discrepancy to enable day closing.</p>}</div>}
            </div>
          </section>

          <section className="lg:col-span-5"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50/70 p-4 sm:px-6"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><Vault size={19} /></div><div><h2 className="font-bold text-slate-900">Float & Final Settlement</h2><p className="text-xs text-slate-500">Configure opening float for tomorrow and review deposit</p></div></div><div className="space-y-5 p-5 sm:p-6"><div><label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-800"><span>Hold for Next Day (Opening Float)</span><span className="text-xs text-slate-500">Optional</span></label><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-bold text-slate-400">LKR</span><input type="number" min="0" step="0.01" value={holdNextDayAmount} onChange={(e) => setHoldNextDayAmount(e.target.value)} placeholder="0.00" disabled={isPageLocked} className={`h-11 w-full rounded-xl border bg-white pl-14 pr-4 text-right text-sm font-semibold outline-none focus:ring-4 ${!isHoldAmountValid ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"}`} /></div>{!isHoldAmountValid && <p className="mt-1.5 text-xs font-medium text-red-600">Hold amount cannot exceed actual counted cash.</p>}<p className="mt-1 text-xs text-slate-500">Amount left in the drawer for tomorrow's starting float.</p></div><div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Net Cash to Safe / Bank</p><p className="mt-0.5 text-xs text-slate-500">Actual Count minus Tomorrow's Float</p></div><p className="text-lg font-bold text-blue-600">{formatLkr(Math.max(0, actualCash - holdAmount))}</p></div></div><div><label className="mb-1.5 block text-sm font-semibold text-slate-800">Closing Notes <span className="text-xs font-normal text-slate-500">(Optional)</span></label><textarea rows={3} value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} placeholder="Add any additional shift or management notes..." disabled={isPageLocked} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" /></div><div className="space-y-2.5 border-t border-slate-100 pt-2"><button type="button" onClick={() => setShowCloseModal(true)} disabled={!canCloseDay || loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 cursor-pointer"><Lock size={17} /> Close Business Day</button><button type="button" onClick={handleGeneratePdf} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"><Download size={17} /> Download Summary Report</button></div></div></div></section>
        </div>
      </div>

      {showCloseModal && <CloseDayModal dayEndData={dayEndData} defaultDate={defaultDate} closingNotes={closingNotes} setClosingNotes={setClosingNotes} totalRevenue={financialSummary.totalRevenue} totalTransactions={financialSummary.totalTransactions} canCloseDay={canCloseDay} isPageLocked={isPageLocked} loading={loading} formatLkr={formatLkr} onClose={() => setShowCloseModal(false)} onConfirm={handlePerformDayEnd} />}
      {showSuccessModal && createPortal(<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={36} /></div><h2 className="text-2xl font-bold text-slate-900">Day End Completed</h2><p className="mt-2 text-sm leading-6 text-slate-500">The business day has been successfully closed.</p><p className="mt-2 text-xs text-slate-400">Please sign in again to begin operations for the next business day.</p><button type="button" onClick={handleContinueToLogin} className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700">Continue to Login</button></div></div>, document.body)}
    </main>
  );
}

function SummaryCard({ title, value, subtitle, icon, iconClassName }: { title: string; value: string; subtitle: string; icon: ReactNode; iconClassName: string }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>{icon}</div><div className="min-w-0"><p className="text-sm font-medium text-slate-500">{title}</p><p className="mt-0.5 truncate text-2xl font-bold text-slate-900">{value}</p><p className="mt-0.5 text-xs text-slate-400">{subtitle}</p></div></div>;
}

function BreakdownCard({ label, value, subtext, highlight = false }: { label: string; value: string; subtext: string; highlight?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${highlight ? "border-blue-200 bg-blue-50/70" : "border-slate-200 bg-slate-50/60"}`}><p className={`text-xs font-semibold ${highlight ? "text-blue-600" : "text-slate-500"}`}>{label}</p><p className={`mt-1.5 truncate text-lg font-bold ${highlight ? "text-blue-950" : "text-slate-900"}`}>{value}</p><p className="mt-1 text-[11px] text-slate-500">{subtext}</p></div>;
}

function StatusBadge({ entered, balanced, shortage }: { entered: boolean; balanced: boolean; shortage: boolean }) {
  if (!entered) return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Pending Count</span>;
  return balanced ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><Check size={13} /> Balanced</span> : <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${shortage ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{shortage ? <AlertCircle size={13} /> : <AlertTriangle size={13} />} {shortage ? "Shortage" : "Surplus"}</span>;
}

function CloseDayModal({ dayEndData, defaultDate, closingNotes, setClosingNotes, totalRevenue, totalTransactions, canCloseDay, isPageLocked, loading, formatLkr, onClose, onConfirm }: { dayEndData: any; defaultDate: string; closingNotes: string; setClosingNotes: (value: string) => void; totalRevenue: number; totalTransactions: number; canCloseDay: boolean; isPageLocked: boolean; loading: boolean; formatLkr: (amount: number) => string; onClose: () => void; onConfirm: () => void }) {
  return createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"><Lock size={20} /></div><div><h2 className="text-xl font-bold text-slate-900">Confirm Business Day End</h2><p className="text-sm text-slate-500">Review before locking the working day.</p></div></div><button type="button" onClick={onClose} disabled={loading} className="flex cursor-pointer h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={20} /></button></div><div className="space-y-4 p-5 sm:p-6"><div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex justify-between text-sm"><span className="text-slate-500">Working Date</span><span className="font-bold text-slate-900">{dayEndData?.currentDate?.split("T")[0] || defaultDate}</span></div><div className="mt-3 flex justify-between text-sm"><span className="text-slate-500">Total Day Revenue</span><span className="font-bold text-slate-900">{formatLkr(totalRevenue)} ({totalTransactions} orders)</span></div></div><div><label className="mb-1.5 block text-sm font-semibold text-slate-800">Closing Notes <span className="text-xs font-normal text-slate-500">(Optional)</span></label><textarea value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} placeholder="Add any notes about today's operations..." rows={4} className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-800"><strong>Important:</strong> Finalizing day end will close operations for this working date. This action cannot be reverted.</div></div><div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><button type="button" onClick={onClose} disabled={loading} className="h-11 rounded-xl border border-slate-200 cursor-pointer bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancel</button><button type="button" onClick={onConfirm} disabled={!canCloseDay || isPageLocked || loading} className="inline-flex cursor-pointer h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300">{loading ? "Closing Day..." : <><Check size={17} /> Confirm & Close Day</>}</button></div></div></div>, document.body);
}
