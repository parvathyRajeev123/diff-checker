import React, { useState, useEffect } from 'react';
import {
  Search,
  FileText,
  Mail,
  ExternalLink,
  Save,
  CheckCircle,
  ChevronRight,
  Languages,
  Eye,
  Download,
  History,
  Bold,
  Italic,
  Underline,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Type,
  Layout,
  Inbox,
  X,
  Plus,
  MessageSquare,
  Smartphone
} from 'lucide-react';
 
// --- Mock Data ---
const MOCK_FORMS = [
  {
    clientId: "20799",
    designator: "ER0102E",
    service: "Emergency Department",
    effectiveDate: "4/1/2026",
    sldFormId: "555102",
    version: "1",
    createdBy: "Pytha Sone",
    lastModified: "3/11/2026 9:23 AM",
    languages: ["Spanish - Spain", "Haitian Creole - Haiti"],
    content: [
      { id: "Q1", section: "ARRIVAL", english: "Comfort of the waiting area", translation: "", type: "Survey Question" },
      { id: "Q2", section: "ARRIVAL", english: "Courtesy of the person who took your child's personal/insurance information", translation: "", type: "Survey Question" },
      { id: "Q3", section: "NURSES", english: "Courtesy of the nurses", translation: "", type: "Survey Question" },
      { id: "W1", section: "WELCOME", english: "Dear Patient or parent or guardian, our mission is to provide our patients with high quality healthcare.", translation: "", type: "Welcome Page Text" },
    ],
    emailTemplate: [
      {
        id: "SMS1",
        section: "SMS",
        english: "Your feedback is important to us. Please take a survey about your visit to Facility Name {SURVEY_LINK}",
        translation: "",
        type: "SMS Body Text 1"
      },
      {
        id: "ES2",
        section: "EMAIL",
        english: "{MD_NAME} would like your feedback!",
        translation: "",
        type: "Email Subject Line 2"
      },
      {
        id: "EB2",
        section: "EMAIL",
        english: "Dear {FIRST_NAME}\n\nRecently, you had a TeleHealth visit with {MD_NAME}.\n\nWe strive to provide you with an exceptional experience and value your feedback. By sharing your thoughts and feelings about your recent visit, you can help us improve the quality of care we provide for you, your family, friends and neighbors.\n\nPlease take a moment to fill out the enclosed survey by clicking the link below or pasting into your web browser:\n\n{SURVEY_LINK}\n\nIf clicking the above link does not take you to the survey or a verification screen, please go to https://esurvey.company.com and enter the following PIN: {PIN}\n\nIn an effort to be transparent, we regularly share patient feedback on our website, yet please be assured that your responses are completely confidential. \n\nIf you would like to discuss your recent visit with a patient advocate, please call {number}. \n\nThank you, and please accept our best wishes for your good health.\n\nSincerely,",
        translation: "",
        type: "Email Body Text 2"
      }
    ]
  }
];
 
const LANGUAGE_DB = {
  "Spanish - Spain": "Su opinión es importante para nosotros. Por favor, realice una encuesta sobre su visita a [Nombre del centro] {SURVEY_LINK}",
  "Haitian Creole - Haiti": "Feedback ou enpòtan pou nou. Tanpri pran yon sondaj sou vizit ou nan Non Etablisman an {SURVEY_LINK}"
};
 
const SurveyTranslatorPage = () => {
  const [view, setView] = useState('landing');
  const [activeForm, setActiveForm] = useState(null);
  const [currentTab, setCurrentTab] = useState('survey'); // 'survey' or 'email'
  const [searchParams, setSearchParams] = useState({ clientId: '', designator: '' });
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLang, setSelectedLang] = useState(null);
  const [hideTranslated, setHideTranslated] = useState(false);
  const [showPreview, setShowPreview] = useState(null);
  const [notification, setNotification] = useState(null);
 
  const notify = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };
 
  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      const form = MOCK_FORMS.find(f => f.clientId === searchParams.clientId);
      if (form) {
        setActiveForm({ ...form });
        setView('editor');
      } else {
        notify("Form not found. Try Client ID: 20799");
      }
      setIsSearching(false);
    }, 800);
  };
 
  const updateTranslation = (id, value) => {
    const key = currentTab === 'survey' ? 'content' : 'emailTemplate';
    const updatedItems = activeForm[key].map(item =>
      item.id === id ? { ...item, translation: value } : item
    );
    setActiveForm({ ...activeForm, [key]: updatedItems });
  };
 
  const toggleLanguageComplete = (lang) => {
    const incomplete = [...activeForm.content, ...activeForm.emailTemplate].filter(i => !i.translation);
    if (incomplete.length > 0) {
      notify(`Cannot complete: items remaining in ${incomplete[0].section}.`);
      return;
    }
    notify(`${lang} marked as Complete!`);
  };
 
  const LandingPage = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-800 mb-2 font-serif tracking-tight text-center">Survey Translator</h1>
        <p className="text-slate-500 italic text-center">Enterprise Translation Management System Demo</p>
      </div>
     
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {[
          { id: 'survey', label: 'Survey Form', icon: <FileText className="w-8 h-8"/>, color: 'bg-blue-600' },
          { id: 'template', label: 'Template Form', icon: <Layout className="w-8 h-8"/>, color: 'bg-indigo-600' },
          { id: 'cover', label: 'Cover Letter', icon: <Mail className="w-8 h-8"/>, color: 'bg-cyan-600' },
          { id: 'email', label: 'Email/SMS Template', icon: <Smartphone className="w-8 h-8"/>, color: 'bg-sky-600' },
          { id: 'envelope', label: 'Envelope', icon: <Inbox className="w-8 h-8"/>, color: 'bg-blue-800' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'email') {
                setCurrentTab('email');
                setView('search');
              } else {
                setCurrentTab('survey');
                setView('search');
              }
            }}
            className="flex flex-col items-center p-8 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all hover:-translate-y-1 group"
          >
            <div className={`${item.color} text-white p-4 rounded-lg mb-4 group-hover:scale-110 transition-transform`}>
              {item.icon}
            </div>
            <span className="font-semibold text-slate-700">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
 
  const SearchModal = () => (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center gap-2 uppercase tracking-wide">
            <Search className="w-5 h-5"/> Search Survey Forms
          </h2>
          <button onClick={() => setView('landing')}><X className="w-5 h-5 text-slate-400 hover:text-white"/></button>
        </div>
       
        <div className="p-8 grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Client ID</label>
              <input
                type="text"
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchParams.clientId}
                onChange={e => setSearchParams({...searchParams, clientId: e.target.value})}
                placeholder="e.g. 20799"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Service Designator</label>
              <input
                type="text"
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchParams.designator}
                onChange={e => setSearchParams({...searchParams, designator: e.target.value})}
                placeholder="e.g. ER0102E"
              />
            </div>
          </div>
         
          <div className="border rounded-md p-4 bg-slate-50">
            <label className="block text-sm font-medium text-slate-600 mb-2">Languages (optional)</label>
            <div className="text-sm space-y-2 max-h-32 overflow-y-auto">
              {['Spanish - Spain', 'French', 'Arabic', 'Haitian Creole', 'Chinese'].map(l => (
                <div key={l} className="flex items-center gap-2">
                  <input type="checkbox" className="rounded text-blue-600" />
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
 
        <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
          <button
            onClick={() => setView('landing')}
            className="px-6 py-2 rounded-md border border-slate-300 hover:bg-white text-slate-600 transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-8 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
          >
            {isSearching ? 'SEARCHING...' : 'SEARCH'}
          </button>
        </div>
      </div>
    </div>
  );
 
  const EditorView = () => (
    <div className="flex flex-col h-screen bg-white">
      {/* Header Toolbar */}
      <div className="h-14 border-b bg-slate-800 text-white flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('landing')} className="hover:text-blue-400 font-bold tracking-tight text-lg uppercase font-serif">
            SURVEY TRANSLATOR
          </button>
          <div className="h-6 w-px bg-slate-600 mx-2" />
          <div className="flex gap-1">
            <button className="p-2 hover:bg-slate-700 rounded"><Bold className="w-5 h-5"/></button>
            <button className="p-2 hover:bg-slate-700 rounded"><Italic className="w-5 h-5"/></button>
            <button className="p-2 hover:bg-slate-700 rounded"><Underline className="w-5 h-5"/></button>
            <div className="w-px h-6 bg-slate-700 mx-1 self-center" />
            <button className="p-2 hover:bg-slate-700 rounded"><AlignLeft className="w-5 h-5"/></button>
            <button className="p-2 hover:bg-slate-700 rounded"><AlignCenter className="w-5 h-5"/></button>
            <button className="p-2 hover:bg-slate-700 rounded"><AlignRight className="w-5 h-5"/></button>
            <div className="w-px h-6 bg-slate-700 mx-1 self-center" />
            <select className="bg-transparent text-sm border border-slate-600 rounded px-2 py-1 outline-none">
              <option>Font Size 12</option>
              <option>Font Size 14</option>
              <option>Font Size 16</option>
            </select>
          </div>
        </div>
       
        <div className="flex items-center gap-3">
          <button onClick={() => notify('Progress saved.')} className="bg-slate-700 hover:bg-slate-600 px-6 py-2 rounded flex items-center gap-2 text-sm font-semibold">
            <Save className="w-4 h-4" /> SAVE
          </button>
          <div className="relative group">
            <button className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded flex items-center gap-2 text-sm font-semibold shadow-md">
              <Eye className="w-4 h-4" /> PREVIEW <ChevronRight className="w-3 h-3 rotate-90" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-56 bg-white shadow-xl rounded-md border border-slate-200 hidden group-hover:block z-50 overflow-hidden">
               <button onClick={() => setShowPreview('online')} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 flex items-center gap-2 border-b transition-colors">
                <Layout className="w-4 h-4 text-blue-500" /> Online Preview
               </button>
               <button onClick={() => setShowPreview('mail')} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 flex items-center gap-2 border-b transition-colors">
                <Inbox className="w-4 h-4 text-blue-500" /> Mail Preview
               </button>
               <button onClick={() => setShowPreview('export')} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 flex items-center gap-2 transition-colors">
                <Download className="w-4 h-4 text-blue-500" /> Export Preview
               </button>
            </div>
          </div>
        </div>
      </div>
 
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Meta & Languages */}
        <div className="w-72 border-r bg-slate-50 flex flex-col shadow-inner">
          <div className="p-4 border-b bg-white">
            <h3 className="text-sm font-bold text-slate-800 mb-1">{activeForm.clientId}_{activeForm.designator}</h3>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Rev #{activeForm.version} • {activeForm.service}</p>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Effective Date:</span>
                <span className="font-medium">{activeForm.effectiveDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SLD Form ID:</span>
                <span className="font-medium text-blue-600 underline cursor-pointer">{activeForm.sldFormId}</span>
              </div>
             
              <button
                onClick={() => setCurrentTab('survey')}
                className={`w-full text-left mt-4 flex items-center gap-2 p-2 rounded transition-all font-semibold ${currentTab === 'survey' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}
              >
                <FileText className="w-4 h-4" /> Survey Content
              </button>
 
              <button
                onClick={() => setCurrentTab('email')}
                className={`w-full text-left flex items-center gap-2 p-2 rounded transition-all font-semibold border ${currentTab === 'email' ? 'bg-blue-600 text-white shadow-md border-blue-600' : 'text-blue-600 border-blue-100 hover:bg-blue-50'}`}
              >
                <MessageSquare className="w-4 h-4" /> Associated Email/SMS Template
              </button>
            </div>
          </div>
         
          <div className="flex-1 overflow-y-auto">
            <div className="bg-slate-200 p-2 text-[10px] font-bold text-slate-600 flex justify-between uppercase tracking-wider">
              <span>LANGUAGES</span>
              <button
                onClick={() => toggleLanguageComplete(selectedLang)}
                className="bg-blue-600 text-white px-2 py-0.5 rounded-sm hover:bg-blue-700 flex items-center gap-1 shadow-sm"
              >
                <CheckCircle className="w-3 h-3" /> Complete
              </button>
            </div>
            {activeForm.languages.map(lang => (
              <button
                key={lang}
                onClick={() => setSelectedLang(lang)}
                className={`w-full p-4 text-left text-sm flex items-center justify-between border-b transition-colors ${selectedLang === lang ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'bg-white hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${lang === "Spanish - Spain" ? "bg-green-500" : "bg-slate-300 shadow-inner"}`} />
                  <span className={selectedLang === lang ? 'font-bold text-blue-900' : 'text-slate-700'}>{lang}</span>
                </div>
                {lang === "Spanish - Spain" && <CheckCircle className="w-4 h-4 text-green-600" />}
              </button>
            ))}
          </div>
        </div>
 
        {/* Center - Translation Grid (Expanded) */}
        <div className="flex-1 overflow-y-auto bg-white p-8">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                {currentTab === 'survey' ? <Languages className="w-8 h-8 text-blue-600" /> : <MessageSquare className="w-8 h-8 text-blue-600" />}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  {selectedLang ? `${selectedLang} - ${currentTab === 'survey' ? 'Survey Content' : 'Email/SMS Template'}` : 'Select a language to begin'}
                </h2>
                <p className="text-sm text-slate-500">{currentTab === 'survey' ? 'Translating patient questions' : 'Translating invitation and reminders'}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setHideTranslated(!hideTranslated)}
                className={`px-4 py-2 rounded border text-sm font-semibold transition-all shadow-sm ${hideTranslated ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 hover:border-blue-400'}`}
              >
                {hideTranslated ? 'Show All Items' : 'Hide Translated Items'}
              </button>
              <button className="px-4 py-2 rounded border text-sm font-semibold bg-white text-slate-600 hover:border-blue-400 shadow-sm">
                Hide Changes
              </button>
            </div>
          </div>
 
          <div className="border rounded-xl shadow-lg overflow-hidden border-slate-100">
            <table className="w-full text-base border-collapse table-fixed">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold border-b">
                <tr>
                  <th className="p-4 text-left w-12"><Plus className="w-4 h-4"/></th>
                  <th className="p-4 text-left w-44 tracking-tight">Description</th>
                  <th className="p-4 text-left w-[38%]">English Content</th>
                  <th className="p-4 text-left">Foreign Translation ({selectedLang})</th>
                </tr>
              </thead>
              <tbody>
                {(currentTab === 'survey' ? activeForm.content : activeForm.emailTemplate)
                  .filter(item => hideTranslated ? !item.translation : true)
                  .map((item, idx) => (
                  <tr key={item.id} className={`border-b group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                    <td className="p-4 text-center">
                      <input type="checkbox" className="w-5 h-5 rounded text-blue-600 border-slate-300" />
                    </td>
                    <td className="p-4 align-top">
                      <div className="font-bold text-slate-800 text-xs mb-1 uppercase tracking-tight">{item.section}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{item.type}</div>
                    </td>
                    <td className="p-6 align-top text-slate-700 leading-relaxed text-base border-r font-medium whitespace-pre-wrap">
                      {item.english}
                    </td>
                    <td className="p-6">
                      <div className="relative">
                        <textarea
                          className="w-full p-5 border-2 border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-base min-h-[180px] transition-all shadow-inner font-normal leading-relaxed text-slate-800"
                          placeholder="Paste database translation here..."
                          value={item.translation}
                          onChange={(e) => updateTranslation(item.id, e.target.value)}
                        />
                        {!item.translation && (
                          <button
                            onClick={() => {
                              const dbVal = (currentTab === 'email' && item.type === 'SMS Body Text 1') ? LANGUAGE_DB[selectedLang] : "N/A";
                              updateTranslation(item.id, dbVal);
                            }}
                            className="absolute bottom-4 right-4 text-xs bg-slate-800 text-white border-none px-4 py-2 rounded-lg shadow-lg hover:bg-blue-600 transition-all font-bold uppercase tracking-wider"
                          >
                            Use DB Value
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
 
        {/* Right Sidebar - Reference/Instructions */}
        <div className="w-80 border-l bg-slate-50 overflow-y-auto p-4 hidden lg:block shadow-inner text-center">
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Information Center</h3>
            <History className="w-4 h-4 text-slate-400" />
          </div>
         
          <div className="space-y-6">
            <section>
              <h4 className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wide">Translation Tracking</h4>
              <div className="bg-white p-4 rounded-xl border border-slate-100 text-[11px] leading-relaxed text-slate-600 shadow-sm text-center">
                Matches SLD Form ID <strong>{activeForm.sldFormId}</strong>.<br/>
                Created by <strong>{activeForm.createdBy}</strong>.<br/>
                Last Modified: <strong>{activeForm.lastModified}</strong>.
              </div>
            </section>
 
            <section>
              <h4 className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wide">Editor Guidelines</h4>
              <ul className="text-[11px] space-y-3 text-slate-600 list-disc pl-4 font-medium text-left">
                <li>Follow specific guidelines for <strong>{selectedLang}</strong>.</li>
                <li>Copy sentence by sentence from the CMS database.</li>
                <li><strong>{currentTab === 'email' ? 'Ensure variable placeholders like {SURVEY_LINK}, {MD_NAME}, and {FIRST_NAME} are maintained exactly in the translation.' : 'Only one return is allowed after greetings.'}</strong></li>
                <li>Ensure facility names match exactly.</li>
              </ul>
            </section>
 
            <section>
              <h4 className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wide">Available Databases</h4>
              <div className="space-y-2">
                {['ENGL_SPANISH', 'ENGL_HAITIAN', 'ENGL_ARABIC'].map(db => (
                  <div key={db} className="flex items-center gap-2 p-2 bg-white border border-slate-100 rounded-lg text-[10px] text-slate-500 group cursor-pointer hover:border-blue-300 transition-all shadow-sm">
                    <FileText className="w-4 h-4 text-green-600" />
                    <span className="truncate flex-1 font-semibold">{db}_8.3.23.xlsx</span>
                    <Download className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
 
      {/* Preview Modal Overlay */}
      {showPreview && (
        <div className="fixed inset-0 bg-slate-900/95 z-[100] flex flex-col items-center p-8 md:p-12">
          <div className="flex justify-between w-full max-w-6xl text-white mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-bold uppercase tracking-widest">{showPreview} Preview</h2>
              <div className="px-3 py-1 bg-blue-600 text-[10px] font-bold rounded shadow-lg">DRAFT VERSION</div>
            </div>
            <button onClick={() => setShowPreview(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-8 h-8" />
            </button>
          </div>
         
          <div className="flex-1 w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-y-auto p-12 relative">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.02] rotate-[-35deg] flex items-center justify-center text-[150px] font-bold text-black select-none">
              PREVIEW
            </div>
           
            {showPreview === 'online' && (
              <div className="max-w-3xl mx-auto space-y-8">
                <div className="h-14 w-56 bg-slate-200 animate-pulse rounded flex items-center justify-center text-xs text-slate-400 font-bold">LOGO: {activeForm.service}</div>
                <h1 className="text-4xl font-bold text-slate-800 border-b-2 pb-6 text-center">{activeForm.service} Survey</h1>
                <div className="prose prose-slate max-w-none">
                  <p className="font-semibold text-xl leading-relaxed text-slate-700 text-center">{activeForm.content.find(i => i.id === 'W1')?.translation || activeForm.content.find(i => i.id === 'W1')?.english}</p>
                  <div className="p-8 bg-slate-50 rounded-2xl border-2 border-slate-100 mt-8">
                    <h3 className="text-base font-bold text-slate-500 uppercase mb-6 tracking-widest text-center">Questions Preview</h3>
                    {activeForm.content.filter(i => i.type === 'Survey Question').map(q => (
                      <div key={q.id} className="mb-10 last:mb-0">
                        <p className="font-bold text-slate-800 mb-4 text-lg text-center">{q.translation || q.english}</p>
                        <div className="grid grid-cols-5 gap-3">
                          {['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'].map(opt => (
                            <div key={opt} className="h-10 border rounded-lg flex items-center justify-center text-xs text-slate-500 bg-white shadow-sm text-center">{opt}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="w-full py-5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all uppercase tracking-widest text-lg shadow-lg">Start Survey</button>
              </div>
            )}
 
            {showPreview === 'mail' && (
              <div className="space-y-12">
                <div className="p-10 border-2 border-dashed border-slate-200 rounded-2xl max-w-lg mx-auto md:mx-0">
                   <div className="flex justify-between items-start mb-16">
                    <div className="h-12 w-40 bg-slate-100 rounded-md" />
                    <div className="text-xs text-slate-400 text-right font-medium">710 RUSH STREET<br/>SOUTH BEND, IN 46801</div>
                   </div>
                   <div className="mt-24 ml-20 h-5 w-64 bg-slate-100 rounded-sm" />
                   <div className="mt-3 ml-20 h-5 w-48 bg-slate-100 rounded-sm" />
                   <div className="mt-12 text-center text-xs text-slate-300 font-mono italic tracking-tighter uppercase">ENVELOPE PACKAGE VIEW</div>
                </div>
                <div className="p-16 border shadow-2xl max-w-3xl mx-auto bg-white min-h-[800px] rounded-sm">
                  <div className="h-16 w-56 bg-slate-200 mb-12" />
                  <p className="text-base mb-6 font-medium">Date: {new Date().toLocaleDateString()}</p>
                  <p className="text-lg font-bold mb-8 text-slate-900 underline underline-offset-4">RE: Your visit to {activeForm.service}</p>
                  <p className="text-lg leading-relaxed mb-10 text-slate-800">
                    {activeForm.content.find(i => i.id === 'W1')?.translation || activeForm.content.find(i => i.id === 'W1')?.english}
                  </p>
                  <p className="text-base italic text-slate-500 bg-slate-50 p-4 rounded-lg border-l-4 border-slate-300">Please return this survey in the pre-paid envelope provided.</p>
                </div>
              </div>
            )}
 
            {showPreview === 'export' && (
               <div className="max-w-4xl mx-auto border rounded-2xl overflow-hidden shadow-2xl bg-slate-50">
                  <div className="bg-white border-b p-6 flex items-center gap-5">
                    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shadow-inner">SM</div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-900">
                        {activeForm.emailTemplate.find(i => i.type === 'Email Subject Line 2')?.translation || activeForm.emailTemplate.find(i => i.type === 'Email Subject Line 2')?.english}
                      </div>
                      <div className="text-xs text-slate-500">From: Survey Manager &lt;noreply@survey.org&gt;</div>
                    </div>
                  </div>
                  <div className="p-16 bg-white m-6 rounded-xl shadow-inner border border-slate-100">
                    <div className="space-y-6 whitespace-pre-wrap">
                      <p className="text-lg leading-relaxed text-slate-700">
                        {activeForm.emailTemplate.find(i => i.type === 'Email Body Text 2')?.translation || activeForm.emailTemplate.find(i => i.type === 'Email Body Text 2')?.english}
                      </p>
                      <button className="px-10 py-4 bg-blue-600 text-white font-black rounded-lg shadow-md hover:bg-blue-700 transition-colors uppercase tracking-widest">
                        Take Survey
                      </button>
                    </div>
                    <div className="mt-16 pt-10 border-t text-xs text-slate-400 leading-relaxed italic">
                      This is an automated message. Please do not reply. To unsubscribe from future mailings, click here.
                    </div>
                  </div>
               </div>
            )}
          </div>
        </div>
      )}
 
      {/* Global Notification */}
      {notification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce z-[200] border-2 border-blue-500/50 backdrop-blur-sm">
          <CheckCircle className="w-6 h-6 text-blue-400" />
          <span className="font-bold tracking-tight uppercase tracking-wider text-center">{notification}</span>
        </div>
      )}
    </div>
  );
 
  return (
    <div className="antialiased text-slate-900 h-screen font-sans">
      {view === 'landing' && <LandingPage />}
      {view === 'search' && <SearchModal />}
      {view === 'editor' && <EditorView />}
    </div>
  );
};
 
export default SurveyTranslatorPage;