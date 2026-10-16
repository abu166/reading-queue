// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Markdown } from "../../src/components/Markdown";
import { NoteEditor } from "../../src/features/notes/NoteEditor";
import * as api from "../../src/lib/api";
vi.mock("../../src/lib/api", () => ({ saveNote: vi.fn(), getNote: vi.fn() }));
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});
it("does not render executable HTML, script URLs, or remote Markdown images", () => {
  const { container } = render(
    <Markdown>
      {
        "<script>alert(1)</script>\n\n[click](javascript:alert)\n\n![track](https://example.com/pixel)"
      }
    </Markdown>,
  );
  expect(container.querySelector("script,img")).toBeNull();
  expect(container.querySelector("a")?.getAttribute("href")).not.toMatch(
    /^javascript:/,
  );
});
it("retains a draft when saving fails", async () => {
  vi.mocked(api.saveNote).mockRejectedValue(new TypeError("offline"));
  render(
    <NoteEditor id="a" userId="u" initial={{ body: "old", version: 1 }} />,
  );
  fireEvent.change(screen.getByLabelText("Private Markdown note"), {
    target: { value: "new thought" },
  });
  fireEvent.click(screen.getByText("Save note"));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("Network"),
  );
  expect(
    JSON.parse(sessionStorage.getItem("reading-queue-draft:u:a")!).body,
  ).toBe("new thought");
});
it("shows newer text on a conflict without replacing the draft", async () => {
  vi.mocked(api.saveNote).mockRejectedValue({ code: "40001" });
  vi.mocked(api.getNote).mockResolvedValue({
    body: "newer remote",
    version: 2,
  });
  render(
    <NoteEditor id="a" userId="u" initial={{ body: "old", version: 1 }} />,
  );
  fireEvent.change(screen.getByLabelText("Private Markdown note"), {
    target: { value: "my draft" },
  });
  fireEvent.click(screen.getByText("Save note"));
  await screen.findByText("A newer note exists");
  expect(
    (screen.getByLabelText("Private Markdown note") as HTMLTextAreaElement)
      .value,
  ).toBe("my draft");
  expect(screen.getByText("newer remote")).toBeTruthy();
});

it("requires a deliberate merge when a recovered draft predates cloud edits", () => {
  sessionStorage.setItem(
    "reading-queue-draft:u:a",
    JSON.stringify({ body: "recovered older draft", version: 1 }),
  );
  render(
    <NoteEditor
      id="a"
      userId="u"
      initial={{ body: "latest cloud note", version: 2 }}
    />,
  );
  expect(screen.getByText("A newer note exists")).toBeTruthy();
  expect(
    (screen.getByLabelText("Private Markdown note") as HTMLTextAreaElement)
      .value,
  ).toBe("recovered older draft");
  expect(api.saveNote).not.toHaveBeenCalled();
});
