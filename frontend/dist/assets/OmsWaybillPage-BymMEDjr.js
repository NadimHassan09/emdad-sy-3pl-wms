import{r as d,j as e}from"./vendor-react-ESlAFUXX.js";import{u as g}from"./vendor-query-8jR4oG_I.js";import{O as m}from"./oms-bAWyhSyh.js";import{B as i}from"./Button-Dqi8QAMs.js";import{O as u}from"./OmsWaybillView-CUJZwJ8V.js";import{b as j,a as w}from"./vendor-router-D-JjZdYf.js";import"./vendor-WenSfUxR.js";import"./index-D_KhS8R3.js";import"./vendor-realtime-BIIei4U1.js";function E(){const{id:r}=j(),p=w(),[a,x]=d.useState(!0),[n,o]=d.useState(!1),{data:t,isLoading:s,isError:c,error:l}=g({queryKey:["oms-waybill",r],queryFn:()=>r?m.getWaybill(r):Promise.reject(new Error("No ID")),enabled:!!r,staleTime:6e4}),f=async()=>{if(!(!r||!t))try{o(!0),await m.downloadWaybillPdf(r,t.orderNumber)}catch(b){console.error("Failed to download waybill PDF:",b),alert(a?"فشل تحميل ملف PDF للبوليصة":"Failed to download waybill PDF")}finally{o(!1)}},h=()=>{window.print()};return e.jsxs("div",{className:"min-h-screen bg-slate-100 text-slate-900 pb-12 print:bg-white print:p-0 print:m-0",children:[e.jsx("header",{className:"sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 shadow-xs print:hidden",children:e.jsxs("div",{className:"max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsxs(i,{variant:"secondary",size:"sm",onClick:()=>p(-1),className:"gap-1.5",children:[e.jsx("i",{className:"fa-solid fa-arrow-right rtl:rotate-0 ltr:rotate-180 text-xs","aria-hidden":"true"}),e.jsx("span",{children:a?"رجوع":"Back"})]}),e.jsxs("div",{children:[e.jsxs("h1",{className:"text-sm font-black text-slate-900 flex items-center gap-2",children:[e.jsx("span",{children:a?"بوليصة الشحن":"Shipping Waybill"}),t&&e.jsx("span",{className:"font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-300",children:t.orderNumber}),e.jsxs("span",{className:"inline-flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300",children:[e.jsx("i",{className:"fa-solid fa-receipt text-[10px]","aria-hidden":"true"}),e.jsx("span",{children:"10 × 15 cm"})]})]}),e.jsx("p",{className:"text-[11px] text-slate-500 font-medium",children:a?"معاينة وطباعة بوليصة الشحن المعتمدة بمقاس 10 × 15 سم (طابعات حرارية 4×6 إنش)":'Official 10 × 15 cm thermal shipping waybill (4×6")'})]})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-2",children:[e.jsxs("button",{type:"button",onClick:()=>x(!a),className:"inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors",children:[e.jsx("i",{className:"fa-solid fa-globe text-xs","aria-hidden":"true"}),e.jsx("span",{children:a?"English":"عربي"})]}),(t==null?void 0:t.labelUrl)&&e.jsxs(i,{variant:"secondary",size:"sm",onClick:()=>window.open(t.labelUrl,"_blank"),className:"gap-1.5",children:[e.jsx("i",{className:"fa-solid fa-arrow-up-right-from-square text-xs","aria-hidden":"true"}),e.jsx("span",{children:a?"بوليصة الناقل الأصلية":"Carrier PDF Label"})]}),e.jsxs(i,{variant:"secondary",size:"sm",onClick:f,disabled:s||!t||n,className:"gap-1.5 border-slate-300 font-bold",children:[e.jsx("i",{className:n?"fa-solid fa-spinner fa-spin text-xs":"fa-solid fa-file-pdf text-rose-600 text-xs","aria-hidden":"true"}),e.jsx("span",{children:a?"تحميل PDF":"Download PDF"})]}),e.jsxs(i,{variant:"primary",size:"sm",onClick:h,disabled:s||!t,className:"gap-1.5 bg-primary text-white font-bold",children:[e.jsx("i",{className:"fa-solid fa-print text-xs","aria-hidden":"true"}),e.jsx("span",{children:a?"طباعة البوليصة":"Print"})]})]})]})}),e.jsx("main",{className:"max-w-4xl mx-auto p-4 sm:p-6 print:p-0 print:max-w-none",children:s?e.jsxs("div",{className:"flex flex-col items-center justify-center py-24 text-center space-y-3",children:[e.jsx("i",{className:"fa-solid fa-spinner fa-spin text-3xl text-primary","aria-hidden":"true"}),e.jsx("p",{className:"text-sm font-medium text-slate-600",children:a?"جاري تجهيز بيانات بوليصة الشحن...":"Preparing waybill details..."})]}):c||!t?e.jsxs("div",{className:"rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-800 my-8",children:[e.jsx("i",{className:"fa-solid fa-circle-exclamation text-2xl mb-2 text-rose-600","aria-hidden":"true"}),e.jsx("p",{className:"font-bold text-base",children:a?"تعذر استخراج بيانات بوليصة الشحن":"Failed to load waybill"}),e.jsx("p",{className:"text-xs text-rose-600 mt-1 font-mono",children:l instanceof Error?l.message:"Unknown error"})]}):e.jsx("div",{className:"print:m-0 print:p-0",children:e.jsx(u,{waybill:t,isArabic:a})})}),e.jsx("style",{children:`
        @media print {
          @page {
            size: 100mm 150mm;
            margin: 0;
          }
          html, body {
            width: 100mm !important;
            height: 150mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            width: 100mm !important;
          }
          .waybill-paper {
            width: 96mm !important;
            max-width: 96mm !important;
            height: 146mm !important;
            max-height: 146mm !important;
            border: 1.5px solid #000000 !important;
            box-shadow: none !important;
            padding: 3mm !important;
            margin: 2mm auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
        }
      `})]})}export{E as OmsWaybillPage,E as default};
