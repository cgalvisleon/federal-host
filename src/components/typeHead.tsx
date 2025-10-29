import React, {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useState,
} from "react";

interface Option {
  id: number;
  label: string;
}

interface TypeaheadProps {
  fetchUrl: string;
  placeholder?: string;
  onSelect: (option: Option) => void;
}

const Typeahead: React.FC<TypeaheadProps> = ({
  fetchUrl,
  placeholder,
  onSelect,
}) => {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState<Option[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const getLastToken = (text: string): string => {
    const parts = text.split(" ");
    return parts[parts.length - 1];
  };

  const replaceLastToken = (text: string, newToken: string): string => {
    const parts = text.split(" ");
    parts[parts.length - 1] = newToken;
    return parts.join(" ");
  };

  useEffect(() => {
    const controller = new AbortController();

    const last = getLastToken(query).trim();
    if (last === "") {
      setFiltered([]);
      return;
    }

    // Llamada al API con debounce pequeño
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const url = `${fetchUrl}?q=${encodeURIComponent(last)}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Error al obtener sugerencias");

        const data: Option[] = await res.json();
        setFiltered(data);
        setHighlightedIndex(data.length > 0 ? 0 : -1);
      } catch (err) {
        if (!(err instanceof DOMException)) {
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    }, 300); // ⏳ debounce 300ms

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, fetchUrl]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowSuggestions(true);
  };

  const handleSelect = (option: Option) => {
    const newValue = replaceLastToken(query, option.label);
    setQuery(newValue);
    setShowSuggestions(false);
    onSelect(option);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filtered.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        setHighlightedIndex((prev) =>
          prev < filtered.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(filtered[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
    }
  };

  return (
    <div style={{ position: "relative", width: "250px" }}>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{ width: "100%", padding: "8px" }}
        className="border rounded p-2"
      />
      {showSuggestions && filtered.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #ccc",
            zIndex: 1000,
            maxHeight: "150px",
            overflowY: "auto",
          }}
        >
          {filtered.map((option, index) => (
            <li
              key={option.id}
              onClick={() => handleSelect(option)}
              style={{
                padding: "8px",
                cursor: "pointer",
                backgroundColor:
                  highlightedIndex === index ? "#e6f0ff" : "transparent",
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Typeahead;
