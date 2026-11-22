const actions = document.querySelector('.module-actions');

const groups = '.playback-toggle,.designer,.voice-choices,.playback-control,.round-navigation,.shake-action,.voice-commands,.microphone';
let activeObserver;
function bindSidebar() {
  activeObserver?.disconnect();
  actions.replaceChildren();
  const frame = [...document.querySelectorAll('iframe')].find(el => !el.hidden);
  const doc = frame?.contentDocument;
  if (!doc?.body) return;
  const roots = [...doc.querySelectorAll(groups)];
  if (!roots.length) return;
  if (!doc.querySelector('#external-controls-style')) {
    const style = doc.createElement('style');
    style.id = 'external-controls-style';
    style.textContent = groups.split(',').map(selector => 'html '+selector).join(',') +
      '{position:fixed!important;left:-200vw!important;right:auto!important;top:0!important;bottom:auto!important} html,body{overflow:hidden}';
    doc.head.append(style);
  }
  const pairs = [];
  for (const root of roots) {
    const controls = root.matches('button') ? [root] : [...root.querySelectorAll('button,select,.status,.camera-name')];
    for (const control of controls) {
      const copy = document.createElement(control.matches('button,select') ? control.localName : 'span');
      if (copy instanceof HTMLButtonElement) {
        copy.type = 'button';
        copy.addEventListener('click', () => control.click());
      } else if (copy instanceof HTMLSelectElement) {
        copy.addEventListener('change', () => {
          control.value = copy.value;
          control.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));
        });
      }
      actions.append(copy);
      pairs.push([control,copy]);
    }
  }
  function update() {
    for (const [control,copy] of pairs) {
      copy.hidden = !control.getClientRects().length || !!control.closest('[hidden]');
      copy.disabled = control.disabled;
      if (copy.tagName === 'SELECT') {
        if (copy.innerHTML !== control.innerHTML) copy.innerHTML = control.innerHTML;
        copy.value = control.value;
      } else copy.textContent = control.textContent;
      for (const key of ['aria-label','aria-pressed']) {
        if (control.hasAttribute(key)) copy.setAttribute(key,control.getAttribute(key));
        else copy.removeAttribute(key);
      }
    }
  }
  activeObserver = new MutationObserver(update);
  for (const root of roots) activeObserver.observe(root,{subtree:true,attributes:true,childList:true,characterData:true});
  update();
}
for (const frame of document.querySelectorAll('iframe')) {
  frame.addEventListener('load',bindSidebar);
  new MutationObserver(bindSidebar).observe(frame,{attributes:true,attributeFilter:['hidden']});
}

const notes = document.querySelector('.prototype-notes');
const noteInput = notes.querySelector('textarea');
const noteStatus = notes.querySelector('[role="status"]');
const usesHomeKey = location.pathname.endsWith('/plan1.html');
const notePrefix = 'zigzag.home.notes.' + (usesHomeKey ? '1' : '2');
const screenElement = window.homeDevice.screen;
const drafts = new Map();
let noteKey;

function fitNoteHeight() {
  noteInput.style.height = '0px';
  const border = noteInput.offsetHeight - noteInput.clientHeight;
  noteInput.style.height = (noteInput.scrollHeight + border) + 'px';
}
let noteWidth;
new ResizeObserver(([entry]) => {
  if (noteWidth === entry.contentRect.width) return;
  noteWidth = entry.contentRect.width;
  fitNoteHeight();
}).observe(noteInput);

function showPageNote() {
  const page = screenElement.dataset.page || (usesHomeKey ? 'apps' : 'idle');
  const section = page === 'apps' ? 'apps.ui' + (screenElement.dataset.ui || '1') : page;
  const hasIdleNote = !usesHomeKey && section === 'idle';
  const key = notePrefix + '.' + (hasIdleNote ? 'idle.step-back' : section);
  if (key === noteKey) return;
  noteKey = key;
  noteStatus.textContent = '';
  noteInput.value = hasIdleNote ? noteInput.defaultValue : '';
  if (drafts.has(key)) {
    noteInput.value = drafts.get(key);
    fitNoteHeight();
    noteStatus.textContent = '未保存';
    return;
  }
  try {
    if (usesHomeKey) {
      const copied = 'zigzag.home.migrations.copyAllNotes.v1';
      if (!localStorage.getItem(copied)) {
        // The storage prefixes predate the swap of the displayed plan names.
        const source = 'zigzag.home.notes.2.';
        const keys = Object.keys(localStorage).filter(key => key.startsWith(source));
        for (const key of keys) {
          if (key === source + 'idle' || key.startsWith(source + 'idle.')) continue;
          const value = localStorage.getItem(key);
          if (value !== null) localStorage.setItem(notePrefix + '.' + key.slice(source.length), value);
        }
        if (keys.length) localStorage.setItem(copied, 'done');
      }
    }
    const reviewKey = 'zigzag.home.migrations.appReview.' + notePrefix;
    if (!localStorage.getItem(reviewKey)) {
      const task = '\n\n共同测试任务：「你想去拍照，能带我去吗？」先不提示滚轮用法，观察孩子是在辨认 Snap、转到 Snap，还是按下进入时犹豫。';
      const reviews = {
        '1': `形式 1 · 系统式轮播
中心图标和名称显示当前选中的功能，外围弧条提示还有其他入口。转动滚轮时，弧条长短和中心内容一起变化。
观察点：孩子能否指出现在选中了什么，并发现滚轮可以切换功能？`,
        '1.1': `形式 1 的变体 · 风车轮播
四个功能分布在风车扇叶上。转动滚轮时，扇叶旋转，图标始终朝上；靠近实体滚轮的右侧扇叶高亮。按下滚轮，选中的扇叶轻轻向左回弹，进入对应功能。
观察点：孩子能否把右侧高亮和手边的滚轮联系起来，自己发现按下即可进入？`,
        '2': `形式 2 · 用角色表现功能
同一个 Zig 通过不同配饰呈现四种角色，每种角色对应一个功能，例如戴侦探眼镜的 Zig 对应图鉴。配饰要容易辨认，动画也要跟得上角色的动作。
观察点：第二次回来时，孩子能否凭配饰找回上次使用的功能？`,
        '3': `形式 3 · 大卡聚焦（原始方案）
每次突出一张功能卡，让孩子集中看当前选项。保留这版作为比较基准，用同一个找功能的任务对照其他四版。
观察点：第一次找指定功能时，孩子转了几次滚轮？有没有转过目标或按错入口？`,
        '4': `形式 4 · 全屏场景切换
把四个功能想象成 Zig / Zag 家园里的四个地点。转动滚轮时，当前场景缩小移开，下一个场景移到中央再放大，像是从一个地点到了另一个地点。这版需要为每个地点单独设计插画和动画。
观察点：场景铺满屏幕后，孩子是否知道自己还在选功能，以及按下滚轮才会进入？`
      };
      for (const [ui, body] of Object.entries(reviews)) {
        localStorage.setItem(notePrefix + '.apps.ui' + ui, body + task);
      }
      localStorage.setItem(reviewKey, 'done');
    }
    const assessmentKey = 'zigzag.home.migrations.uiAssessments.' + notePrefix;
    if (!localStorage.getItem(assessmentKey)) {
      const assessments = {
        '1': '图标可复用，动效重点是弧条伸缩与中心图标切换同步。',
        '1.1': '扇叶造型可复用，动效需兼顾旋转时图标朝上、停稳后高亮和按压回弹。',
        '2': '四套角色配饰需要一眼能区分，动画要让配饰跟随 Zig 同步起伏。',
        '3': '四张功能卡可共用版式和切换动效，设计与动效工作量都较低。',
        '4': '四个地点各需一套全屏插画和场景动画，设计与动效工作量最高。'
      };
      for (const [ui, sentence] of Object.entries(assessments)) {
        const uiKey = notePrefix + '.apps.ui' + ui;
        const text = localStorage.getItem(uiKey) ?? '';
        const line = '设计与动效：' + sentence;
        if (text.includes(line)) continue;
        const insert = text.indexOf('\n观察点：');
        const updated = insert < 0 ? [text, line].filter(Boolean).join('\n')
          : text.slice(0, insert) + '\n' + line + text.slice(insert);
        localStorage.setItem(uiKey, updated);
      }
      localStorage.setItem(assessmentKey, 'done');
    }
    const saved = localStorage.getItem(key);
    // Older prototypes had one note per plan. Show it on the starting page.
    noteInput.value = saved ?? (usesHomeKey && section === 'apps.ui1'
      ? localStorage.getItem(notePrefix) : null) ?? noteInput.value;
  } catch {
    noteStatus.textContent = '无法读取本地备注';
  }
  fitNoteHeight();
}
showPageNote();
new MutationObserver(showPageNote).observe(screenElement, {
  attributes: true, attributeFilter: ['data-page', 'data-ui']
});
noteInput.addEventListener('input', () => {
  fitNoteHeight();
  drafts.set(noteKey, noteInput.value);
  noteStatus.textContent = '未保存';
});
notes.querySelector('button').addEventListener('click', () => {
  try {
    localStorage.setItem(noteKey, noteInput.value);
    drafts.delete(noteKey);
    noteStatus.textContent = '已保存';
  } catch {
    noteStatus.textContent = '保存失败，请检查浏览器存储设置';
  }
});
