use irc::client::data::Config;

fn main() {
    let mut config = Config::default();
    config.options.insert("away-notify".to_string(), "".to_string());
}
