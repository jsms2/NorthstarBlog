<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import TurndownService from 'turndown'
import { marked } from 'marked'
import {
  Callout,
  Details,
  Gallery,
  Mermaid,
  MathBlock,
  MathInline,
  Embed,
  ButtonBlock,
  FileAttachment,
} from './extensions'
type MenuEntry = { label: string; icon: string; run: () => void }
const props = defineProps<{ modelValue: string; json?: unknown }>()
const emit = defineEmits<{
  (e: 'update:modelValue' | 'update:html', value: string): void
  (e: 'update:json', value: unknown): void
}>()
const csrf = useCsrf()
const mode = ref<'visual' | 'markdown' | 'preview'>('visual')
const markdown = ref(props.modelValue)
const slash = ref({ open: false, query: '', x: 0, y: 0 })
const menuIndex = ref(0)
const mediaOpen = ref(false)
const media = ref<
  Array<{
    id: string
    url: string
    filename: string
    type: string
    alt: string | null
    caption: string | null
  }>
>([])
const uploadInput = ref<HTMLInputElement>()
const lowlight = createLowlight(common)
let suppress = false
const entries = computed<MenuEntry[]>(() => {
  if (!editor.value) return []
  const e = editor.value
  const all: MenuEntry[] = [
    { label: 'Text', icon: '¶', run: () => e.chain().focus().setParagraph().run() },
    ...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
      label: `Heading ${level}`,
      icon: `H${level}`,
      run: () => e.chain().focus().toggleHeading({ level }).run(),
    })),
    { label: 'Bullet List', icon: '•', run: () => e.chain().focus().toggleBulletList().run() },
    { label: 'Numbered List', icon: '1.', run: () => e.chain().focus().toggleOrderedList().run() },
    { label: 'Task List', icon: '☑', run: () => e.chain().focus().toggleTaskList().run() },
    { label: 'Quote', icon: '❞', run: () => e.chain().focus().toggleBlockquote().run() },
    { label: 'Code', icon: '</>', run: () => e.chain().focus().toggleCodeBlock().run() },
    { label: 'Image', icon: '▧', run: () => (mediaOpen.value = true) },
    {
      label: 'Gallery',
      icon: '▦',
      run: () => {
        mediaOpen.value = true
        galleryMode.value = true
      },
    },
    {
      label: 'Table',
      icon: '▤',
      run: () => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      label: 'Callout',
      icon: '✳',
      run: () =>
        e
          .chain()
          .focus()
          .insertContent({
            type: 'callout',
            attrs: { kind: 'note' },
            content: [{ type: 'paragraph' }],
          })
          .run(),
    },
    { label: 'Divider', icon: '—', run: () => e.chain().focus().setHorizontalRule().run() },
    {
      label: 'Details',
      icon: '⌄',
      run: () =>
        e
          .chain()
          .focus()
          .insertContent({
            type: 'detailsBlock',
            attrs: { summary: '展开阅读' },
            content: [{ type: 'paragraph' }],
          })
          .run(),
    },
    {
      label: 'Mermaid',
      icon: '◇',
      run: () =>
        e
          .chain()
          .focus()
          .insertContent({
            type: 'mermaidBlock',
            content: [{ type: 'text', text: 'graph TD\n  A[开始] --> B[完成]' }],
          })
          .run(),
    },
    {
      label: 'Math',
      icon: '∑',
      run: () =>
        e
          .chain()
          .focus()
          .insertContent({ type: 'mathBlock', content: [{ type: 'text', text: 'E = mc^2' }] })
          .run(),
    },
    {
      label: 'Embed',
      icon: '▷',
      run: () =>
        e
          .chain()
          .focus()
          .insertContent({
            type: 'safeEmbed',
            attrs: { url: 'https://www.youtube.com/embed/', provider: 'youtube' },
          })
          .run(),
    },
  ]
  return all.filter((x) => x.label.toLowerCase().includes(slash.value.query.toLowerCase()))
})
const galleryMode = ref(false)
async function upload(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
  const body = new FormData()
  body.append('file', file)
  const endpoint: string = '/api/admin/media'
  return await $fetch<{ url: string; filename: string }>(endpoint, {
    method: 'POST',
    headers: csrf.value,
    body,
  })
}
const editor = useEditor({
  content: props.json || props.modelValue || '<p></p>',
  extensions: [
    StarterKit.configure({ codeBlock: false }),
    Underline,
    Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] }),
    Image.configure({ allowBase64: false, HTMLAttributes: { class: 'editor-image' } }).extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          alt: { default: null },
          title: { default: null },
          width: { default: null },
          'data-align': { default: 'center' },
        }
      },
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: '开始写作… 输入 / 打开块菜单' }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    CodeBlockLowlight.configure({ lowlight }),
    Callout,
    Details,
    Gallery,
    Mermaid,
    MathBlock,
    MathInline,
    Embed,
    ButtonBlock,
    FileAttachment,
  ],
  editorProps: {
    attributes: { class: 'tiptap-content prose focus:outline-none min-h-[420px] max-w-none' },
    handleDrop: (_view, event) => {
      const files = Array.from(event.dataTransfer?.files || [])
      if (!files.length) return false
      event.preventDefault()
      void Promise.all(files.filter((f) => f.type.startsWith('image/')).map(upload)).then((items) =>
        items.forEach((item) =>
          editor.value?.chain().focus().setImage({ src: item.url, alt: item.filename }).run(),
        ),
      )
      return true
    },
    handlePaste: (_view, event) => {
      const files = Array.from(event.clipboardData?.files || [])
      if (!files.length) return false
      event.preventDefault()
      void Promise.all(files.filter((f) => f.type.startsWith('image/')).map(upload)).then((items) =>
        items.forEach((item) =>
          editor.value?.chain().focus().setImage({ src: item.url, alt: item.filename }).run(),
        ),
      )
      return true
    },
  },
  onUpdate: ({ editor: e }) => {
    if (!suppress) {
      const html = e.getHTML()
      emit('update:html', html)
      emit('update:json', e.getJSON())
      emit(
        'update:modelValue',
        new TurndownService({ codeBlockStyle: 'fenced', headingStyle: 'atx' }).turndown(html),
      )
    }
    const { $from } = e.state.selection
    const txt = $from.parent.textContent
    const match = txt.match(/(?:^|\s)\/([^\s/]*)$/)
    if (match) {
      const c = e.state.selection.from
      const coords = e.view.coordsAtPos(c)
      slash.value = { open: true, query: match[1] || '', x: coords.left, y: coords.bottom + 6 }
      menuIndex.value = 0
    } else slash.value.open = false
  },
})
function execute(entry: MenuEntry) {
  const e = editor.value
  if (!e) return
  const { $from } = e.state.selection
  const match = $from.parent.textContent.match(/(?:^|\s)\/([^\s/]*)$/)
  if (match) {
    const length = match[0].length
    e.chain()
      .focus()
      .deleteRange({ from: e.state.selection.from - length, to: e.state.selection.from })
      .run()
  }
  slash.value.open = false
  entry.run()
}
function keydown(ev: KeyboardEvent) {
  if (!slash.value.open) return
  if (ev.key === 'ArrowDown') {
    ev.preventDefault()
    menuIndex.value = (menuIndex.value + 1) % Math.max(1, entries.value.length)
  } else if (ev.key === 'ArrowUp') {
    ev.preventDefault()
    menuIndex.value =
      (menuIndex.value - 1 + entries.value.length) % Math.max(1, entries.value.length)
  } else if (ev.key === 'Escape') {
    ev.preventDefault()
    slash.value.open = false
  } else if (ev.key === 'Enter' && entries.value[menuIndex.value]) {
    ev.preventDefault()
    execute(entries.value[menuIndex.value]!)
  }
}
async function openMedia() {
  galleryMode.value = false
  mediaOpen.value = true
  const endpoint: string = '/api/admin/media'
  media.value = await $fetch<typeof media.value>(endpoint)
}
function insertMedia(item: (typeof media.value)[number]) {
  const e = editor.value
  if (!e) return
  if (galleryMode.value) {
    const existing = e.getAttributes('gallery').images as Array<unknown> | undefined
    const imgs = existing || []
    e.chain()
      .focus()
      .insertContent({
        type: 'gallery',
        attrs: {
          images: [
            ...imgs,
            { src: item.url, alt: item.alt || item.filename, caption: item.caption || '' },
          ],
        },
      })
      .run()
    galleryMode.value = false
  } else
    e.chain()
      .focus()
      .setImage({ src: item.url, alt: item.alt || item.filename, title: item.caption || undefined })
      .run()
  mediaOpen.value = false
}
function importMarkdown(file: File) {
  const reader = new FileReader()
  reader.onload = () => {
    let text = String(reader.result || '')
    const fm = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/)
    if (fm) text = text.slice(fm[0].length)
    markdown.value = text
    mode.value = 'markdown'
  }
  reader.readAsText(file)
}
async function switchMode(next: 'visual' | 'markdown' | 'preview') {
  if (next === 'visual' && mode.value !== 'visual' && editor.value) {
    suppress = true
    editor.value.commands.setContent(await marked.parse(markdown.value))
    suppress = false
    emit('update:json', editor.value.getJSON())
    emit('update:html', editor.value.getHTML())
  }
  if (next === 'markdown' && mode.value === 'visual' && editor.value)
    markdown.value = new TurndownService({
      codeBlockStyle: 'fenced',
      headingStyle: 'atx',
    }).turndown(editor.value.getHTML())
  mode.value = next
  if (next === 'markdown') emit('update:json', undefined)
}
watch(markdown, (v) => {
  if (mode.value === 'markdown') emit('update:modelValue', v)
})
onBeforeUnmount(() => editor.value?.destroy())
</script>
<template>
  <section
    class="rounded-xl border"
    style="border-color: var(--border); background: var(--surface)"
    @keydown="keydown"
  >
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b p-2"
      style="border-color: var(--border)"
    >
      <div class="flex flex-wrap gap-1">
        <button
          v-for="b in [
            { label: 'Bold', run: () => editor?.chain().focus().toggleBold().run() },
            { label: 'Italic', run: () => editor?.chain().focus().toggleItalic().run() },
            { label: 'Underline', run: () => editor?.chain().focus().toggleUnderline().run() },
            { label: 'Strike', run: () => editor?.chain().focus().toggleStrike().run() },
            { label: 'Inline code', run: () => editor?.chain().focus().toggleCode().run() },
            { label: 'H1', run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
            { label: 'H2', run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
            { label: 'H3', run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
            { label: 'Bullet list', run: () => editor?.chain().focus().toggleBulletList().run() },
            {
              label: 'Numbered list',
              run: () => editor?.chain().focus().toggleOrderedList().run(),
            },
            { label: 'Task list', run: () => editor?.chain().focus().toggleTaskList().run() },
            { label: 'Quote', run: () => editor?.chain().focus().toggleBlockquote().run() },
            { label: 'Code block', run: () => editor?.chain().focus().toggleCodeBlock().run() },
            {
              label: 'Table',
              run: () =>
                editor
                  ?.chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run(),
            },
            { label: 'Undo', run: () => editor?.chain().focus().undo().run() },
            { label: 'Redo', run: () => editor?.chain().focus().redo().run() },
          ]"
          :key="b.label"
          class="focus rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
          :class="
            editor?.isActive(
              b.label === 'Bold'
                ? 'bold'
                : b.label === 'Italic'
                  ? 'italic'
                  : b.label === 'Underline'
                    ? 'underline'
                    : b.label === 'Strike'
                      ? 'strike'
                      : 'code',
            )
              ? 'font-bold text-orange-700'
              : ''
          "
          :aria-label="b.label"
          :title="b.label"
          @click="b.run"
        >
          {{ b.label }}</button
        ><button class="focus rounded px-2 py-1 text-xs" @click="openMedia">图片/媒体</button
        ><label class="focus rounded px-2 py-1 text-xs cursor-pointer"
          >导入 .md<input
            ref="uploadInput"
            type="file"
            accept=".md,text/markdown"
            class="hidden"
            @change="
              ($event.target as HTMLInputElement).files?.[0] &&
              importMarkdown(($event.target as HTMLInputElement).files![0]!)
            " /></label
        ><label class="focus rounded px-2 py-1 text-xs cursor-pointer"
          >插入图片<input
            type="file"
            accept="image/*"
            class="hidden"
            @change="
              ($event.target as HTMLInputElement).files?.[0] &&
              upload(($event.target as HTMLInputElement).files![0]!).then((i) =>
                editor?.chain().focus().setImage({ src: i.url, alt: i.filename }).run(),
              )
            "
        /></label>
      </div>
      <div class="flex gap-1">
        <button
          v-for="m in ['visual', 'markdown', 'preview'] as const"
          :key="m"
          class="rounded px-2 py-1 text-xs"
          :class="mode === m ? 'bg-black/10 dark:bg-white/10' : ''"
          @click="switchMode(m)"
        >
          {{ m === 'visual' ? 'Visual' : m === 'markdown' ? 'Markdown' : 'Preview' }}
        </button>
      </div>
    </div>
    <EditorContent v-if="mode === 'visual'" :editor="editor" /><textarea
      v-else-if="mode === 'markdown'"
      v-model="markdown"
      rows="24"
      class="w-full resize-y bg-transparent p-5 font-mono text-sm leading-7 outline-none"
    />
    <div v-else class="prose min-h-[420px] max-w-none p-5" v-html="editor?.getHTML() || ''" />
    <div
      v-if="slash.open && entries.length"
      class="fixed z-50 max-h-72 w-64 overflow-auto rounded-xl border p-1 shadow-xl"
      :style="{
        left: `${slash.x}px`,
        top: `${slash.y}px`,
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }"
    >
      <button
        v-for="(item, i) in entries"
        :key="item.label"
        class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm"
        :class="i === menuIndex ? 'bg-black/10 dark:bg-white/10' : ''"
        @mousedown.prevent="execute(item)"
      >
        <span class="w-7 text-center">{{ item.icon }}</span
        >{{ item.label }}
      </button>
    </div>
    <div
      v-if="mediaOpen"
      class="fixed inset-0 z-[60] bg-black/50 p-4"
      @click.self="mediaOpen = false"
    >
      <section
        class="mx-auto mt-[8vh] max-h-[80vh] max-w-4xl overflow-auto rounded-2xl p-5"
        style="background: var(--surface)"
      >
        <div class="flex justify-between">
          <h2 class="text-xl font-semibold">选择媒体</h2>
          <button @click="mediaOpen = false">关闭</button>
        </div>
        <label
          class="my-4 inline-block cursor-pointer rounded-lg px-4 py-2 text-white"
          style="background: var(--accent)"
          >上传<input
            type="file"
            accept="image/*"
            class="hidden"
            @change="
              ($event.target as HTMLInputElement).files?.[0] &&
              upload(($event.target as HTMLInputElement).files![0]!).then(
                async () => (media = await $fetch('/api/admin/media')),
              )
            "
        /></label>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            v-for="item in media"
            :key="item.id"
            class="rounded-lg border p-2 text-left"
            @click="insertMedia(item)"
          >
            <img
              v-if="item.type === 'IMAGE'"
              :src="item.url"
              :alt="item.alt || item.filename"
              class="aspect-square w-full rounded object-cover"
            /><span class="block truncate p-1 text-xs">{{ item.filename }}</span>
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
