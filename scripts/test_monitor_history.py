import json
import tempfile
import unittest
from pathlib import Path

import monitor


class MonitorHistoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.old_history = monitor.HISTORY_FILE
        self.old_signals = monitor.SIGNALS_FILE
        monitor.HISTORY_FILE = self.root / "event-history.json"
        monitor.SIGNALS_FILE = self.root / "signals.js"

    def tearDown(self):
        monitor.HISTORY_FILE = self.old_history
        monitor.SIGNALS_FILE = self.old_signals
        self.temp.cleanup()

    def test_first_run_migrates_published_signals_without_mutating_them(self):
        original = [{"id": "sig-legacy", "title": "Legacy signal", "url": "https://news.example/legacy"}]
        monitor.SIGNALS_FILE.write_text("export const signals = " + json.dumps(original) + ";\n", encoding="utf-8")
        loaded = monitor.load_event_history()
        self.assertEqual(loaded, original)
        self.assertFalse(monitor.HISTORY_FILE.exists())

    def test_corrupt_history_is_not_replaced_with_an_empty_archive(self):
        damaged = '{"this is":'
        monitor.HISTORY_FILE.write_text(damaged, encoding="utf-8")
        with self.assertRaises(RuntimeError):
            monitor.load_event_history()
        self.assertEqual(monitor.HISTORY_FILE.read_text(encoding="utf-8"), damaged)

    def test_atomic_write_replaces_the_target_and_leaves_no_temporary_file(self):
        target = self.root / "nested" / "history.json"
        monitor.atomic_write(target, '{"events":[]}\n')
        self.assertEqual(target.read_text(encoding="utf-8"), '{"events":[]}\n')
        self.assertEqual(list(target.parent.iterdir()), [target])


if __name__ == "__main__":
    unittest.main()

