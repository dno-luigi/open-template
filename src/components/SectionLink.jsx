import { useLocation, useNavigate } from "react-router";
import { scrollToSection } from "@wron/kit";

// Link to a section of the home page (#editor, #my-templates, #community).
// On the home page it scrolls; elsewhere it goes home and Layout scrolls on arrival.
export default function SectionLink({ id, children, className, onClick, ...rest }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <a
      href={`/#${id}`}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        if (pathname === "/") {
          scrollToSection(id);
          try {
            window.history.replaceState(null, "", `#${id}`);
          } catch {
            /* some embedded previews block history changes; the scroll already happened */
          }
        } else {
          navigate({ pathname: "/", hash: `#${id}` });
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
