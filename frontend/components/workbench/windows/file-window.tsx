"use client";

/**
 * FileWindow — janela flutuante (app da workstation) com suporte a múltiplas
 * abas. Arrastável pela barra de título e redimensionável por qualquer borda (FloatingFrame).
 * A aba ativa é renderizada pelo FileEditor (Monaco para texto; viewer para
 * mídia e binários). Fechar a última aba fecha a janela.
 */

import { useState } from "react";

import { FileEditor } from "@/components/workbench/file-editor";
import {
  useWindowsStore,
  type FileWindowState,
} from "@/lib/stores/windows-store";
import { m } from "@/lib/paraglide/messages";
import { FloatingFrame } from "@/components/workbench/windows/floating-frame";
import { EditorTab } from "@/components/workbench/windows/editor-tab";
import { editorKey, useEditorRegistry } from "@/lib/stores/editor-registry";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResizableDialogContent } from "@/components/ui/resizable-dialog";
import { Button } from "@/components/ui/button";

export function FileWindow({ win }: { win: FileWindowState }) {
  const focus = useWindowsStore((s) => s.focus);
  const close = useWindowsStore((s) => s.close);
  const closeTab = useWindowsStore((s) => s.closeTab);
  const minimize = useWindowsStore((s) => s.minimize);
  const setActiveTab = useWindowsStore((s) => s.setActiveTab);
  const setBounds = useWindowsStore((s) => s.setBounds);
  const entries = useEditorRegistry((s) => s.entries);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const hasTabs = win.tabs.length > 1;
  const dirtyTabs = win.tabs.filter(
    (tab) => entries[editorKey(win.workspaceId, tab)]?.dirty,
  );

  const requestWindowClose = () => {
    if (dirtyTabs.length > 0) setCloseDialogOpen(true);
    else close(win.id);
  };

  const saveAndCloseWindow = async () => {
    setClosing(true);
    const results = await Promise.all(
      dirtyTabs.map((tab) => entries[editorKey(win.workspaceId, tab)]?.save()),
    );
    setClosing(false);
    if (results.every(Boolean)) {
      setCloseDialogOpen(false);
      close(win.id);
    }
  };

  const tabsBar = hasTabs ? (
    <div className="flex shrink-0 overflow-x-auto border-b border-border/60 bg-muted/20">
      {win.tabs.map((tab) => {
        const isActive = tab === win.activeTab;
        const name = tab.split(/[/\\]/).pop() || tab;
        return (
          <EditorTab
            key={tab}
            name={name}
            path={tab}
            active={isActive}
            dirty={Boolean(entries[editorKey(win.workspaceId, tab)]?.dirty)}
            onActivate={() => setActiveTab(win.id, tab)}
            onClose={() => closeTab(win.id, tab)}
            onSave={() =>
              entries[editorKey(win.workspaceId, tab)]?.save() ??
              Promise.resolve(false)
            }
            onSaveAs={(target) =>
              entries[editorKey(win.workspaceId, tab)]?.saveAs(target) ??
              Promise.resolve(false)
            }
          />
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <FloatingFrame
        rect={{ x: win.x, y: win.y, w: win.w, h: win.h }}
        zIndex={win.zIndex}
        title={win.title}
        titleHint={win.activeTab}
        onFocus={() => focus(win.id)}
        onBoundsChange={(rect) => setBounds(win.id, rect)}
        onMinimize={() => minimize(win.id)}
        onClose={requestWindowClose}
        subHeader={tabsBar}
      >
        <FileEditor workspaceId={win.workspaceId} path={win.activeTab} />
      </FloatingFrame>
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <ResizableDialogContent
          resizable={false}
          defaultWidth={384}
          className="gap-4 p-6"
        >
          <DialogHeader>
            <DialogTitle>{m.workbench_files_discard_title()}</DialogTitle>
            <DialogDescription>
              {m.workbench_files_discard_desc()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              {m.workbench_files_cancel()}
            </Button>
            <Button
              variant="destructive"
              disabled={closing}
              onClick={() => {
                setCloseDialogOpen(false);
                close(win.id);
              }}
            >
              {m.workbench_files_discard()}
            </Button>
            <Button
              disabled={closing}
              onClick={() => void saveAndCloseWindow()}
            >
              {m.workbench_files_save()}
            </Button>
          </DialogFooter>
        </ResizableDialogContent>
      </Dialog>
    </>
  );
}
