import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

export interface BodyEditorOptions {
  parent: HTMLElement;
  doc: string;
  onSaveShortcut: () => void;
  onPaste: (event: ClipboardEvent, view: EditorView) => boolean;
  onDocChanged: (body: string) => void;
  onBlur: () => void;
}

export function createBodyEditor(options: BodyEditorOptions): EditorView {
  const editorView = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              options.onSaveShortcut();
              return true;
            }
          }
        ]),
        EditorView.domEventHandlers({
          paste: (event, view) => options.onPaste(event, view)
        }),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          options.onDocChanged(update.state.doc.toString());
        })
      ]
    })
  });

  editorView.dom.onclick = (event) => event.stopPropagation();
  editorView.dom.onblur = options.onBlur;
  editorView.contentDOM.tabIndex = 0;
  return editorView;
}
