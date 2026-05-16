use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{async_runtime, AppHandle, Emitter};
use tokio::sync::mpsc;

const DEBOUNCE_MS: u64 = 300;

pub struct WatcherState(pub Mutex<Option<WatcherInner>>);

pub struct WatcherInner {
    pub watcher: RecommendedWatcher,
    cancel_tx: mpsc::Sender<()>,
}

impl Default for WatcherState {
    fn default() -> Self {
        WatcherState(Mutex::new(None))
    }
}

pub fn start_watching(app_handle: &AppHandle, state: &WatcherState, path: PathBuf) -> Result<(), String> {
    stop_watching(state);

    let (event_tx, mut event_rx) = mpsc::channel::<Event>(256);
    let (cancel_tx, mut cancel_rx) = mpsc::channel::<()>(1);

    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            if let Ok(event) = res {
                let _ = event_tx.try_send(event);
            }
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    watcher
        .watch(&path, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    let handle = app_handle.clone();
    async_runtime::spawn(async move {
        loop {
            tokio::select! {
                biased;
                event = event_rx.recv() => {
                    match event {
                        Some(_) => {},
                        None => return,
                    }
                }
                _ = cancel_rx.recv() => {
                    return;
                }
            }

            loop {
                tokio::select! {
                    biased;
                    event = event_rx.recv() => {
                        match event {
                            Some(_) => {},
                            None => return,
                        }
                    }
                    _ = tokio::time::sleep(Duration::from_millis(DEBOUNCE_MS)) => {
                        break;
                    }
                    _ = cancel_rx.recv() => {
                        return;
                    }
                }
            }

            let _ = handle.emit("fs-changes", ());
        }
    });

    let inner = WatcherInner { watcher, cancel_tx };
    *state.0.lock().unwrap() = Some(inner);

    Ok(())
}

pub fn stop_watching(state: &WatcherState) {
    if let Some(inner) = state.0.lock().unwrap().take() {
        let _ = inner.cancel_tx.try_send(());
    }
}
