import React, { useState } from 'react';
import { DollarSign, Calculator, TrendingUp, Info, HelpCircle, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface PriceRoyaltyCalculatorProps {
  wordCount?: number;
  bookTitle?: string;
  category?: string;
}

export const PriceRoyaltyCalculator: React.FC<PriceRoyaltyCalculatorProps> = ({
  wordCount = 45000,
  bookTitle = 'Your Book',
  category = 'General Fiction'
}) => {
  // Estimated pages based on ~250 words per page
  const estimatedPages = Math.max(24, Math.round(wordCount / 250));

  // Form State
  const [format, setFormat] = useState<'ebook' | 'paperback' | 'hardcover'>('ebook');
  const [listPrice, setListPrice] = useState<number>(format === 'ebook' ? 4.99 : 14.99);
  const [pageCount, setPageCount] = useState<number>(estimatedPages);
  const [fileSizeMb, setFileSizeMb] = useState<number>(1.2);
  const [paperType, setPaperType] = useState<'bw' | 'color'>('bw');
  const [royaltyTier, setRoyaltyTier] = useState<'70' | '35'>('70');

  // KDP Calculations
  let printingCost = 0;
  let deliveryFee = 0;
  let netProfit = 0;
  let royaltyPercent = 0.70;

  if (format === 'ebook') {
    if (royaltyTier === '70') {
      royaltyPercent = 0.70;
      deliveryFee = Math.max(0, fileSizeMb * 0.15); // $0.15 per MB
    } else {
      royaltyPercent = 0.35;
      deliveryFee = 0;
    }
    netProfit = Math.max(0, (listPrice - deliveryFee) * royaltyPercent);
  } else if (format === 'paperback') {
    royaltyPercent = 0.60;
    // Amazon KDP Paperback BW printing cost: $0.85 fixed + $0.012 per page
    if (paperType === 'bw') {
      printingCost = 0.85 + (pageCount * 0.012);
    } else {
      // Color paper: $1.00 + $0.07 per page
      printingCost = 1.00 + (pageCount * 0.07);
    }
    netProfit = Math.max(0, (listPrice * 0.60) - printingCost);
  } else {
    // Hardcover
    royaltyPercent = 0.60;
    printingCost = 5.65 + (pageCount * 0.012);
    netProfit = Math.max(0, (listPrice * 0.60) - printingCost);
  }

  const profitMarginPercent = listPrice > 0 ? Math.round((netProfit / listPrice) * 100) : 0;

  // Recommended sweet spot pricing guidance
  const getPricingAdvice = () => {
    if (format === 'ebook') {
      if (listPrice < 2.99 && royaltyTier === '70') {
        return {
          type: 'warning',
          text: 'KDP requires list prices between $2.99 and $9.99 to qualify for the 70% royalty tier. Under $2.99, KDP forces the 35% tier.'
        };
      }
      if (listPrice >= 2.99 && listPrice <= 9.99) {
        return {
          type: 'success',
          text: 'Optimal KDP Sweet Spot! $2.99 - $9.99 qualifies for max 70% net royalty rates on Kindle Store.'
        };
      }
      return {
        type: 'info',
        text: 'Prices over $9.99 revert to 35% royalty tier on KDP. Consider $4.99 - $7.99 for highest volume & return.'
      };
    } else {
      const minPrice = Math.ceil((printingCost / 0.60) * 100) / 100;
      if (listPrice < minPrice) {
        return {
          type: 'warning',
          text: `List price is below KDP minimum required price of $${minPrice.toFixed(2)} to cover printing costs ($${printingCost.toFixed(2)}).`
        };
      }
      return {
        type: 'success',
        text: `Covers $${printingCost.toFixed(2)} print cost with $${netProfit.toFixed(2)} profit per physical copy.`
      };
    }
  };

  const advice = getPricingAdvice();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-zinc-900 p-6 rounded-2xl text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg tracking-tight">KDP Price & Net Royalty Optimizer</h3>
          </div>
          <p className="text-xs text-emerald-100 leading-relaxed">
            Calculate exact Amazon KDP royalties, print charges, delivery fees, and net profit margins per copy sold.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20 shrink-0 text-center sm:text-right">
          <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-300">Estimated Net Profit / Sale</p>
          <p className="text-2xl font-extrabold text-white mt-0.5">${netProfit.toFixed(2)} USD</p>
          <span className="text-[10px] text-emerald-200">{profitMarginPercent}% Profit Margin</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-5">
          <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-600" /> Book Parameters
          </h4>

          {/* Format Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Publishing Format</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormat('ebook');
                  setListPrice(4.99);
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                  format === 'ebook'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs ring-1 ring-emerald-500'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                📱 Kindle eBook
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormat('paperback');
                  setListPrice(14.99);
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                  format === 'paperback'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs ring-1 ring-emerald-500'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                📖 Paperback
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormat('hardcover');
                  setListPrice(24.99);
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                  format === 'hardcover'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs ring-1 ring-emerald-500'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                📕 Hardcover
              </button>
            </div>
          </div>

          {/* List Price Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-800">Target Retail List Price ($USD)</label>
              <span className="text-[11px] font-bold text-emerald-700 font-mono">${listPrice.toFixed(2)}</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.99"
              max="200"
              value={listPrice}
              onChange={(e) => setListPrice(parseFloat(e.target.value) || 0)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {format === 'ebook' ? (
            <>
              {/* Royalty Tier Selection */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">KDP Royalty Option</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRoyaltyTier('70')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      royaltyTier === '70'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    70% Royalty Tier ($2.99 - $9.99)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoyaltyTier('35')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      royaltyTier === '35'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    35% Royalty Tier (&lt;$2.99 or &gt;$9.99)
                  </button>
                </div>
              </div>

              {/* Delivery Fee File Size */}
              {royaltyTier === '70' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Estimated eBook File Size (MB) <span className="text-[10px] font-normal text-zinc-500">($0.15/MB Amazon fee)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    value={fileSizeMb}
                    onChange={(e) => setFileSizeMb(parseFloat(e.target.value) || 0.1)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {/* Page Count */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-zinc-700">Manuscript Page Count</label>
                  <span className="text-[10px] text-zinc-500">Auto-calculated from ~{wordCount.toLocaleString()} words</span>
                </div>
                <input
                  type="number"
                  min="24"
                  max="1000"
                  value={pageCount}
                  onChange={(e) => setPageCount(parseInt(e.target.value) || 24)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Internal Paper Type */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Internal Interior Paper</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaperType('bw')}
                    className={`p-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      paperType === 'bw'
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    Black & White Interior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperType('color')}
                    className={`p-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      paperType === 'color'
                        ? 'bg-purple-900 text-white border-purple-900'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    Standard Color Interior
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Breakdown & Analysis Column */}
        <div className="lg:col-span-6 space-y-4">
          {/* Detailed Breakdown Card */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> KDP Financial Breakdown
            </h4>

            <div className="space-y-2 text-xs border-b border-zinc-100 pb-4">
              <div className="flex items-center justify-between text-zinc-600">
                <span>Retail List Price:</span>
                <span className="font-bold text-zinc-900 font-mono">${listPrice.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-zinc-600">
                <span>Amazon KDP Royalty Rate:</span>
                <span className="font-bold text-emerald-700 font-mono">{royaltyPercent * 100}%</span>
              </div>

              {printingCost > 0 && (
                <div className="flex items-center justify-between text-zinc-600">
                  <span>KDP Print Cost ({pageCount} pages):</span>
                  <span className="font-bold text-red-600 font-mono">-${printingCost.toFixed(2)}</span>
                </div>
              )}

              {deliveryFee > 0 && (
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Kindle Delivery Fee ({fileSizeMb} MB):</span>
                  <span className="font-bold text-amber-600 font-mono">-${deliveryFee.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm pt-1">
              <span className="font-extrabold text-zinc-900">Net Creator Profit / Copy:</span>
              <span className="font-extrabold text-emerald-600 text-base font-mono">${netProfit.toFixed(2)} USD</span>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-100 p-3.5 rounded-xl text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Revenue Forecast
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-800">
                100 Sales = <strong className="font-bold text-emerald-950">${(netProfit * 100).toFixed(2)}</strong> | 
                1,000 Sales = <strong className="font-bold text-emerald-950">${(netProfit * 1000).toFixed(2)}</strong> profit.
              </p>
            </div>
          </div>

          {/* Pricing Advice Box */}
          <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
            advice.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
            advice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
            'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}>
            <div className="font-bold flex items-center gap-2">
              {advice.type === 'warning' ? <AlertCircle className="w-4 h-4 text-amber-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              <span>Pricing Guidance & Strategy</span>
            </div>
            <p className="leading-relaxed">{advice.text}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
