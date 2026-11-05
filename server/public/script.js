// Returns the document y position of a source line, interpolated between the
// blocks tagged with `srcline-<n>` by the server. Returns -1 if there are none.
function getLinePosition(line) {
  const anchors = [];
  document.querySelectorAll('[class*="srcline-"]').forEach((el) => {
    const m = el.className.match(/(?:^|\s)srcline-(\d+)(?:\s|$)/);
    if (m) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      anchors.push({ line: parseInt(m[1]), top: top });
    }
  });
  anchors.sort((a, b) => a.line - b.line || a.top - b.top);
  let prev = null;
  let next = null;
  for (const a of anchors) {
    if (a.line <= line) prev = a;
    else {
      next = a;
      break;
    }
  }
  if (prev == null) return anchors.length ? 0 : -1;
  if (next == null) return prev.top;
  const ratio = (line - prev.line) / (next.line - prev.line);
  return prev.top + Math.max(0, ratio * (next.top - prev.top));
}

// scroll so that the source line is at about a third of the window height
function scrollToLine(line, behavior) {
  const pos = getLinePosition(line);
  if (pos < 0) return false;
  window.scrollTo({
    top: Math.max(0, Math.round(pos - window.innerHeight / 3)),
    behavior: behavior,
  });
  return true;
}

// subscribe on server
const es = new EventSource("/api/actions/subscribe");

// receive server event for page reload
es.onmessage = (e) => {
  // check if is server close message
  if (e.data == "close") window.location.reload();
  // scroll only to a source line
  if (e.data.startsWith("line:")) {
    scrollToLine(parseInt(e.data.slice(5)), "smooth");
    return;
  }
  // split `<position>` or `<position>;<line>`
  const [posData, lineData] = e.data.split(";");
  // get url parameters
  const params = new URL(window.location).searchParams;
  // get scroll position
  let pos = parseInt(posData);
  // check scroll type
  if (pos == -1) {
    // dont scroll, keep current preview page position
    pos = `${parseInt(window.scrollY)}px`;
  } else {
    // check and set scroll position in percent
    pos = isNaN(pos) || pos < 0 ? 0 : pos > 100 ? 100 : pos;
  }
  // set parameter 'scroll' for reload
  params.set("scroll", pos);
  if (lineData) params.set("line", lineData);
  else params.delete("line");
  // set url parameter and reload (if new params change url)
  window.location.search = params.toString();
};

// run script after page is loaded
addEventListener("load", (e) => {
  // get url parameters
  const params = new URL(window.location).searchParams;
  // scroll to the source line if given
  const lineParam = parseInt(params.get("line"));
  if (!isNaN(lineParam) && scrollToLine(lineParam, "instant")) return;
  // get 'scroll' parameter
  const scrollParam = params.get("scroll");
  // check 'scroll' parameter for pixel (234px) or percent (50) value
  const isPixel = /^[0-9]+px$/.test(scrollParam) ? true : false;
  const isPercent = !isPixel;
  // parse to int value
  let pos = parseInt(scrollParam);
  // check NaN or less 0
  pos = isNaN(pos) || pos < 0 ? 0 : pos;
  // if percent value
  if (isPercent) {
    // limit to max 100 %
    pos = pos > 100 ? 100 : pos;
    const documentHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;
    // calc relative scroll position to document height
    pos = Math.round((documentHeight * pos) / 100.0 - windowHeight / 2);
  }
  // scroll
  window.scrollTo(0, pos);
});
