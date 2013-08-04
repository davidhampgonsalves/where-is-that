use Rack::Static, 
  :urls => ['/images'],
  :index => "index.html",
  :root => "public"

run lambda { |env|
  [
    200, 
    {
      'Content-Type'  => 'text/html', 
      'Cache-Control' => 'public, max-age=86400' 
    },
    File.open( 'public' + env['PATH_INFO'], File::RDONLY)
  ]
}
