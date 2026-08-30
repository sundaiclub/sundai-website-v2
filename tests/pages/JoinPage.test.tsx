import { render, screen } from "@testing-library/react";

import JoinPage from "../../src/app/join/page";
import { useTheme } from "../../src/app/contexts/ThemeContext";

jest.mock("../../src/app/contexts/ThemeContext");

jest.mock("next/script", () => ({ src, onLoad }: React.ComponentProps<"script">) => (
  <script src={src} onLoad={onLoad} />
));

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<"div">) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;
const loadEmbeds = jest.fn();

describe("JoinPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.Tally = { loadEmbeds };
  });

  it("embeds the restored Tally form", () => {
    mockUseTheme.mockReturnValue({ isDarkMode: false, toggleDarkMode: jest.fn() });

    render(<JoinPage />);

    expect(screen.getByRole("heading", { name: "Join Sundai Club" })).toBeInTheDocument();
    expect(screen.getByTitle("Sundai Club membership form")).toHaveAttribute(
      "data-tally-src",
      "https://tally.so/embed/3ldWJo?hideTitle=1&dynamicHeight=1",
    );
    expect(loadEmbeds).toHaveBeenCalledTimes(1);
  });

  it("uses the dark Tally theme in dark mode", () => {
    mockUseTheme.mockReturnValue({ isDarkMode: true, toggleDarkMode: jest.fn() });

    render(<JoinPage />);

    expect(screen.getByTitle("Sundai Club membership form")).toHaveAttribute(
      "data-tally-src",
      "https://tally.so/embed/3ldWJo?hideTitle=1&dynamicHeight=1&theme=dark",
    );
  });
});
