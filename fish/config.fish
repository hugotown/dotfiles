function on_exit --on-event fish_exit
    echo fish is now exiting
end

abbr --erase z &>/dev/null
alias z=__zoxide_z

abbr --erase zi &>/dev/null
alias zi=__zoxide_zi
