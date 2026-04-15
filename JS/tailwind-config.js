tailwind.config = {
    theme: {
        extend: {
            colors: {
                brand: {
                    50: "#fff7ed",
                    100: "#ffedd5",
                    200: "#fed7aa",
                    300: "#fdba74",
                    400: "#fb923c",
                    500: "#f97316",
                    600: "#ea580c",
                    700: "#c2410c",
                    800: "#9a3412",
                    900: "#7c2d12"
                },
                ink: "#132238",
                sand: "#fff7f0"
            },
            fontFamily: {
                sans: ["Manrope", "sans-serif"],
                display: ["Space Grotesk", "sans-serif"]
            },
            boxShadow: {
                float: "0 22px 55px rgba(15, 23, 42, 0.12)"
            },
            backgroundImage: {
                "hero-noise":
                    "radial-gradient(circle at top left, rgba(255, 183, 77, 0.24), transparent 28%), radial-gradient(circle at bottom right, rgba(251, 146, 60, 0.18), transparent 24%)"
            }
        }
    }
};
