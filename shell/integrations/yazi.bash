# Yazi wrapper - cd to last directory on exit
function y() {
    local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
    yazi "$@" --cwd-file="$tmp"
    IFS= read -r -d "" cwd < "$tmp"
    test -n "$cwd" && test "$cwd" != "$PWD" && builtin cd -- "$cwd"
    rm -f -- "$tmp"
}
