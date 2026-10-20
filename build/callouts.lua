-- Prepends a label paragraph to callout divs; works for HTML and DOCX.
local labels = {
  en = { tip = "Tip", warning = "Warning", agent = "🤖 Agent prompt",
         checkpoint = "Checkpoint", instructor = "Instructor note" },
  ar = { tip = "نصيحة", warning = "تحذير", agent = "🤖 اسأل وكيلك الذكي",
         checkpoint = "نقطة تحقق", instructor = "ملاحظة للمدرّب" },
}
local lang = "en"
function Meta(m) if m.lang and pandoc.utils.stringify(m.lang):sub(1,2) == "ar" then lang = "ar" end end
function Div(d)
  for _, c in ipairs(d.classes) do
    local l = labels[lang][c]
    if l then
      local t = d.attributes["title"] or l
      d.content:insert(1, pandoc.Div({ pandoc.Para({ pandoc.Strong({ pandoc.Str(t) }) }) }, pandoc.Attr("", { "callout-label" })))
      return d
    end
  end
end
return { { Meta = Meta }, { Div = Div } }
